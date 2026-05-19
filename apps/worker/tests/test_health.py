import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from dm_instamap_worker.health import health_payload


class HealthPayloadTests(unittest.TestCase):
    def test_health_payload_is_local_first(self) -> None:
        payload = health_payload()

        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["mode"], "local-first")


if __name__ == "__main__":
    unittest.main()
