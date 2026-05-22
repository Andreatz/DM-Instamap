import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from dm_instamap_worker.health import health_payload
from dm_instamap_worker.jobs import JobStore


class HealthPayloadTests(unittest.TestCase):
    def test_health_payload_is_local_first(self) -> None:
        payload = health_payload()

        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["mode"], "local-first")
        self.assertEqual(payload["version"], "0.1.0")

    def test_health_payload_includes_job_store_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = pathlib.Path(temp_dir) / "jobs.db"
            store = JobStore(db_path)
            store.create_job("test.health", "Queued.")

            payload = health_payload(store)

        self.assertEqual(payload["dbPath"], str(db_path))
        self.assertEqual(payload["jobCounts"]["queued"], 1)
        self.assertEqual(payload["runningJobIds"], [])
        self.assertGreaterEqual(payload["maxConcurrentJobs"], 1)


if __name__ == "__main__":
    unittest.main()
