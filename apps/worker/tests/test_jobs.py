import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from fastapi.testclient import TestClient

from dm_instamap_worker.main import create_app


class WorkerJobTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(create_app())

    def test_lists_jobs(self) -> None:
        response = self.client.get("/jobs")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_asset_scan_job_completes_with_placeholder_result(self) -> None:
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

    def test_reference_scan_job_completes_with_placeholder_result(self) -> None:
        created = self.client.post("/jobs/references/scan", json={"folder": "local-references"})

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]
        payload = self.client.get(f"/jobs/{job_id}").json()

        self.assertEqual(payload["type"], "references.scan")
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["result"]["folder"], "local-references")

    def test_image_analysis_job_completes_with_placeholder_result(self) -> None:
        created = self.client.post("/jobs/images/analyze", json={"imagePath": "map.png"})

        self.assertEqual(created.status_code, 200)
        job_id = created.json()["id"]
        payload = self.client.get(f"/jobs/{job_id}").json()

        self.assertEqual(payload["type"], "images.analyze")
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["result"]["imagePath"], "map.png")

    def test_missing_job_returns_404(self) -> None:
        response = self.client.get("/jobs/job_missing")

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
