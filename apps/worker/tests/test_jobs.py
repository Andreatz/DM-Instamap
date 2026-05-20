import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

GLOBAL_DB_DIR = tempfile.TemporaryDirectory()
os.environ["DM_INSTAMAP_JOBS_DB"] = str(pathlib.Path(GLOBAL_DB_DIR.name) / "global-jobs.db")

from fastapi.testclient import TestClient

from dm_instamap_worker.jobs import JobStore, run_subprocess_job
from dm_instamap_worker.main import create_app
from dm_instamap_worker.models import JobStatus


SAMPLE_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c02"
    "0000000b4944415478da63fcff1f0003030200efbfa7db0000000049454e44ae426082"
)


def complete_asset_scan(store: JobStore, job_id: str, folder: str) -> None:
    store.update_job(
        job_id,
        status=JobStatus.completed,
        progress=100,
        message="Job completed.",
        result={"folder": folder, "stdout": "Scanned 1 assets with 0 errors."},
    )


def complete_reference_scan(store: JobStore, job_id: str, folder: str) -> None:
    store.update_job(
        job_id,
        status=JobStatus.completed,
        progress=100,
        message="Job completed.",
        result={"folder": folder, "stdout": "Scanned 1 reference maps with 0 errors."},
    )


def tearDownModule() -> None:
    GLOBAL_DB_DIR.cleanup()


class WorkerJobTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = pathlib.Path(self.temp_dir.name) / "jobs.db"
        self.store = JobStore(self.db_path)
        self.client = TestClient(create_app(self.store))

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_lists_jobs(self) -> None:
        response = self.client.get("/jobs")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_asset_scan_job_completes_with_local_runner_result(self) -> None:
        with patch("dm_instamap_worker.routes.assets.run_asset_scan_job", complete_asset_scan):
            created = self.client.post("/jobs/assets/scan", json={"folder": "local-assets"})

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]

        response = self.client.get(f"/jobs/{job_id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["type"], "assets.scan")
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["progress"], 100)
        self.assertEqual(payload["result"]["folder"], "local-assets")
        self.assertIn("Scanned", payload["result"]["stdout"])

    def test_reference_scan_job_completes_with_local_runner_result(self) -> None:
        with patch("dm_instamap_worker.routes.references.run_reference_scan_job", complete_reference_scan):
            created = self.client.post("/jobs/references/scan", json={"folder": "local-references"})

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]
        payload = self.client.get(f"/jobs/{job_id}").json()

        self.assertEqual(payload["type"], "references.scan")
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["result"]["folder"], "local-references")

    def test_image_analysis_job_reads_local_png_metadata(self) -> None:
        image_path = pathlib.Path(self.temp_dir.name) / "map.png"
        image_path.write_bytes(SAMPLE_PNG)

        created = self.client.post("/jobs/images/analyze", json={"imagePath": str(image_path)})

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]
        payload = self.client.get(f"/jobs/{job_id}").json()

        self.assertEqual(payload["type"], "images.analyze")
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["result"]["imagePath"], str(image_path))
        self.assertEqual(payload["result"]["analysis"]["width"], 1)
        self.assertEqual(payload["result"]["analysis"]["height"], 1)
        self.assertFalse(payload["result"]["analysis"]["transparency"])
        self.assertGreater(len(payload["result"]["analysis"]["dominantColors"]), 0)

    def test_missing_job_returns_404(self) -> None:
        response = self.client.get("/jobs/job_missing")

        self.assertEqual(response.status_code, 404)

    def test_jobs_are_persisted_to_sqlite(self) -> None:
        job = self.store.create_job("test.persist", "Queued.")
        self.store.update_job(
            job.id,
            status=JobStatus.completed,
            progress=100,
            message="Done.",
            result={"ok": True},
        )

        reloaded_store = JobStore(self.db_path)
        reloaded_job = reloaded_store.get_job(job.id)

        self.assertEqual(reloaded_job.status, JobStatus.completed)
        self.assertEqual(reloaded_job.result, {"ok": True})

    def test_subprocess_runner_captures_success_output(self) -> None:
        job = self.store.create_job("test.subprocess", "Queued.")

        run_subprocess_job(
            self.store,
            job.id,
            [sys.executable, "-c", "print('scanner ok')"],
            "Running test command.",
            {"folder": "fixtures"},
            cwd=pathlib.Path(self.temp_dir.name),
        )

        completed = self.store.get_job(job.id)
        self.assertEqual(completed.status, JobStatus.completed)
        self.assertEqual(completed.result["exitCode"], 0)
        self.assertEqual(completed.result["stdout"], "scanner ok")

    def test_subprocess_runner_marks_failures(self) -> None:
        job = self.store.create_job("test.subprocess", "Queued.")

        run_subprocess_job(
            self.store,
            job.id,
            [sys.executable, "-c", "import sys; sys.stderr.write('bad folder'); sys.exit(2)"],
            "Running test command.",
            cwd=pathlib.Path(self.temp_dir.name),
        )

        failed = self.store.get_job(job.id)
        self.assertEqual(failed.status, JobStatus.failed)
        self.assertEqual(failed.result["exitCode"], 2)
        self.assertEqual(failed.error, "bad folder")


if __name__ == "__main__":
    unittest.main()
