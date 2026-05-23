import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

GLOBAL_DB_DIR = tempfile.TemporaryDirectory()
os.environ["DM_INSTAMAP_JOBS_DB"] = str(
    pathlib.Path(GLOBAL_DB_DIR.name) / "global-jobs.db"
)

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
        with patch(
            "dm_instamap_worker.routes.assets.run_asset_scan_job", complete_asset_scan
        ):
            created = self.client.post(
                "/jobs/assets/scan", json={"folder": "local-assets"}
            )

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]

        response = self.client.get(f"/jobs/{job_id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["type"], "assets.scan")
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["progress"], 100)
        self.assertTrue(payload["result"]["folder"].endswith("local-assets"))
        self.assertIn("Scanned", payload["result"]["stdout"])

    def test_reference_scan_job_completes_with_local_runner_result(self) -> None:
        with patch(
            "dm_instamap_worker.routes.references.run_reference_scan_job",
            complete_reference_scan,
        ):
            created = self.client.post(
                "/jobs/references/scan", json={"folder": "local-references"}
            )

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]
        payload = self.client.get(f"/jobs/{job_id}").json()

        self.assertEqual(payload["type"], "references.scan")
        self.assertEqual(payload["status"], "completed")
        self.assertTrue(payload["result"]["folder"].endswith("local-references"))

    def test_image_analysis_job_reads_local_png_metadata(self) -> None:
        image_path = pathlib.Path(self.temp_dir.name) / "map.png"
        image_path.write_bytes(SAMPLE_PNG)

        created = self.client.post(
            "/jobs/images/analyze", json={"imagePath": str(image_path)}
        )

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]
        payload = self.client.get(f"/jobs/{job_id}").json()

        self.assertEqual(payload["type"], "images.analyze")
        self.assertEqual(payload["status"], "completed")
        # The job returns the resolved (canonical) path; compare canonically so
        # Windows 8.3 short names (RUNNER~1 vs runneradmin) do not cause a false
        # mismatch.
        self.assertEqual(
            pathlib.Path(payload["result"]["imagePath"]).resolve(),
            image_path.resolve(),
        )
        self.assertEqual(payload["result"]["analysis"]["width"], 1)
        self.assertEqual(payload["result"]["analysis"]["height"], 1)
        self.assertFalse(payload["result"]["analysis"]["transparency"])
        self.assertGreater(len(payload["result"]["analysis"]["dominantColors"]), 0)

    def test_import_pack_job_uses_local_runner(self) -> None:
        def complete(
            store: JobStore,
            job_id: str,
            *,
            root: str,
            preset: str,
            default_tags: list[str],
        ) -> None:
            store.update_job(
                job_id,
                status=JobStatus.completed,
                progress=100,
                message="Job completed.",
                result={"root": root, "preset": preset, "defaultTags": default_tags},
            )

        with patch(
            "dm_instamap_worker.routes.assets.run_asset_import_pack_job", complete
        ):
            created = self.client.post(
                "/jobs/assets/import-pack",
                json={
                    "root": "./packs/fa",
                    "preset": "forgotten-adventures",
                    "defaultTags": ["fa", "dungeon"],
                },
            )

        self.assertEqual(created.status_code, 200)
        payload = self.client.get(f"/jobs/{created.json()['id']}").json()
        self.assertEqual(payload["type"], "assets.import-pack")
        self.assertEqual(payload["status"], "completed")
        self.assertTrue(
            payload["result"]["root"].endswith(str(pathlib.Path("packs") / "fa"))
        )
        self.assertEqual(payload["result"]["preset"], "forgotten-adventures")
        self.assertEqual(payload["result"]["defaultTags"], ["fa", "dungeon"])

    def test_rejects_path_traversal_for_scan_jobs(self) -> None:
        response = self.client.post("/jobs/assets/scan", json={"folder": "../../"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("Relative paths must stay inside", response.text)

    def test_rejects_remote_host_without_explicit_opt_in(self) -> None:
        response = self.client.get(
            "/health", headers={"host": "dm-instamap.example.com"}
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("non include autenticazione", response.text)

    def test_asset_generate_job_uses_local_runner(self) -> None:
        def complete(store: JobStore, job_id: str, **kwargs) -> None:  # noqa: ANN003
            store.update_job(
                job_id,
                status=JobStatus.completed,
                progress=100,
                message="Job completed.",
                result={
                    "prompt": kwargs["prompt"],
                    "classification": kwargs["classification"],
                },
            )

        with patch("dm_instamap_worker.routes.assets.run_asset_generate_job", complete):
            created = self.client.post(
                "/jobs/assets/generate",
                json={
                    "prompt": "ornate iron door",
                    "classification": "door",
                    "seed": 42,
                },
            )

        self.assertEqual(created.status_code, 200)
        payload = self.client.get(f"/jobs/{created.json()['id']}").json()
        self.assertEqual(payload["type"], "assets.generate")
        self.assertEqual(payload["result"]["prompt"], "ornate iron door")
        self.assertEqual(payload["result"]["classification"], "door")

    def test_ai_plan_job_uses_local_runner(self) -> None:
        def complete(
            store: JobStore, job_id: str, *, user_request: str, max_retries: int | None
        ) -> None:
            store.update_job(
                job_id,
                status=JobStatus.completed,
                progress=100,
                message="Job completed.",
                result={"userRequest": user_request, "maxRetries": max_retries},
            )

        with patch("dm_instamap_worker.routes.ai.run_ai_plan_job", complete):
            created = self.client.post(
                "/jobs/ai/plan",
                json={"userRequest": "crypt under cathedral", "maxRetries": 2},
            )

        self.assertEqual(created.status_code, 200)
        payload = self.client.get(f"/jobs/{created.json()['id']}").json()
        self.assertEqual(payload["type"], "ai.plan")
        self.assertEqual(payload["result"]["userRequest"], "crypt under cathedral")
        self.assertEqual(payload["result"]["maxRetries"], 2)

    def test_session_pack_job_uses_local_runner(self) -> None:
        def complete(store: JobStore, job_id: str, **kwargs) -> None:  # noqa: ANN003
            store.update_job(
                job_id,
                status=JobStatus.completed,
                progress=100,
                message="Job completed.",
                result={"projectId": kwargs["project_id"], "scale": kwargs["scale"]},
            )

        with patch(
            "dm_instamap_worker.routes.exports.run_exports_session_pack_job", complete
        ):
            created = self.client.post(
                "/jobs/exports/session-pack",
                json={"projectId": "crypt", "scale": 2, "includeInitiative": True},
            )

        self.assertEqual(created.status_code, 200)
        payload = self.client.get(f"/jobs/{created.json()['id']}").json()
        self.assertEqual(payload["type"], "exports.session-pack")
        self.assertEqual(payload["result"]["projectId"], "crypt")

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
        self.assertEqual(completed.log["lastCommand"][0], sys.executable)
        self.assertGreaterEqual(completed.log["durationMs"], 0)

    def test_subprocess_runner_marks_failures(self) -> None:
        job = self.store.create_job("test.subprocess", "Queued.")

        run_subprocess_job(
            self.store,
            job.id,
            [
                sys.executable,
                "-c",
                "import sys; sys.stderr.write('bad folder'); sys.exit(2)",
            ],
            "Running test command.",
            cwd=pathlib.Path(self.temp_dir.name),
        )

        failed = self.store.get_job(job.id)
        self.assertEqual(failed.status, JobStatus.failed)
        self.assertEqual(failed.result["exitCode"], 2)
        self.assertEqual(failed.error, "bad folder")
        self.assertEqual(failed.log["stderrTail"], "bad folder")

    def test_running_jobs_are_marked_failed_after_restart(self) -> None:
        job = self.store.create_job("test.restart", "Queued.")
        self.store.update_job(
            job.id, status=JobStatus.running, progress=25, message="Running."
        )

        reloaded_store = JobStore(self.db_path)
        reloaded_job = reloaded_store.get_job(job.id)

        self.assertEqual(reloaded_job.status, JobStatus.failed)
        self.assertEqual(reloaded_job.error, "Job interrupted by worker restart.")
        self.assertTrue(reloaded_job.log["interrupted"])

    def test_cleanup_old_terminal_jobs(self) -> None:
        job = self.store.create_job("test.cleanup", "Queued.")
        self.store.update_job(
            job.id, status=JobStatus.completed, progress=100, message="Done."
        )

        removed = self.store.cleanup_old_jobs(max_age_days=0, max_terminal_jobs=500)

        self.assertEqual(removed, 1)
        with self.assertRaises(KeyError):
            self.store.get_job(job.id)


if __name__ == "__main__":
    unittest.main()
