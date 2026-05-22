import os
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

from fastapi import HTTPException

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from dm_instamap_worker.security import (
    is_broad_or_system_path,
    is_local_host_header,
    remote_access_allowed,
    validate_local_path,
)


class ValidateLocalPathTests(unittest.TestCase):
    def test_resolves_relative_path_inside_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            repo_root = pathlib.Path(root)
            resolved = validate_local_path("local-assets/pack", repo_root=repo_root)
            self.assertEqual(
                pathlib.Path(resolved), (repo_root / "local-assets/pack").resolve()
            )

    def test_rejects_relative_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(HTTPException) as ctx:
                validate_local_path("../secret", repo_root=pathlib.Path(root))
            self.assertEqual(ctx.exception.status_code, 400)

    def test_rejects_empty_path(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(HTTPException):
                validate_local_path("   ", repo_root=pathlib.Path(root))

    def test_rejects_broad_home_path(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(HTTPException) as ctx:
                validate_local_path(
                    str(pathlib.Path.home()), repo_root=pathlib.Path(root)
                )
            self.assertEqual(ctx.exception.status_code, 400)

    def test_rejects_system_folder(self) -> None:
        system_folder = "C:\\Windows" if os.name == "nt" else "/etc"
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(HTTPException):
                validate_local_path(system_folder, repo_root=pathlib.Path(root))

    def test_allows_specific_absolute_local_folder(self) -> None:
        # Il worker scansiona librerie asset locali fuori dal repo: i path
        # assoluti non-broad/system sono ammessi (semantica intenzionale).
        with (
            tempfile.TemporaryDirectory() as root,
            tempfile.TemporaryDirectory() as library,
        ):
            resolved = validate_local_path(
                library, repo_root=pathlib.Path(root), must_exist=True
            )
            self.assertEqual(pathlib.Path(resolved), pathlib.Path(library).resolve())

    def test_must_exist_rejects_missing(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(HTTPException) as ctx:
                validate_local_path(
                    "missing-pack", repo_root=pathlib.Path(root), must_exist=True
                )
            self.assertEqual(ctx.exception.status_code, 400)


class BroadOrSystemPathTests(unittest.TestCase):
    def test_home_and_drive_root_are_broad(self) -> None:
        home = pathlib.Path.home().resolve()
        self.assertTrue(is_broad_or_system_path(home))
        drive_root = pathlib.Path(home.anchor)
        self.assertTrue(is_broad_or_system_path(drive_root))

    def test_specific_local_folder_is_not_broad(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            self.assertFalse(is_broad_or_system_path(pathlib.Path(folder).resolve()))


class HostHeaderTests(unittest.TestCase):
    def test_local_hosts_are_accepted(self) -> None:
        self.assertTrue(is_local_host_header(None))
        self.assertTrue(is_local_host_header("127.0.0.1:8000"))
        self.assertTrue(is_local_host_header("localhost"))

    def test_remote_host_is_rejected(self) -> None:
        self.assertFalse(is_local_host_header("example.com"))
        self.assertFalse(is_local_host_header("10.0.0.5:8000"))


class AllowRemoteIndependenceTests(unittest.TestCase):
    @mock.patch.dict(os.environ, {"DM_INSTAMAP_ALLOW_REMOTE": "true"})
    def test_allow_remote_does_not_relax_path_validation(self) -> None:
        self.assertTrue(remote_access_allowed())

        with tempfile.TemporaryDirectory() as root:
            repo_root = pathlib.Path(root)
            with self.assertRaises(HTTPException):
                validate_local_path("../secret", repo_root=repo_root)
            with self.assertRaises(HTTPException):
                validate_local_path(str(pathlib.Path.home()), repo_root=repo_root)


if __name__ == "__main__":
    unittest.main()
