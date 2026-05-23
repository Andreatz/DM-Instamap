from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import HTTPException, Request, Response
from fastapi.responses import PlainTextResponse

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]", "testserver"}


def remote_access_allowed() -> bool:
    return os.environ.get("DM_INSTAMAP_ALLOW_REMOTE") == "true"


def is_local_host_header(host_header: str | None) -> bool:
    if not host_header:
        return True
    host = host_header.rsplit(":", 1)[0].lower()
    return host in LOCAL_HOSTS


async def reject_remote_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    if not remote_access_allowed() and not is_local_host_header(
        request.headers.get("host")
    ):
        return PlainTextResponse(
            "DM-Instamap Worker non include autenticazione. Usalo solo da localhost o imposta DM_INSTAMAP_ALLOW_REMOTE=true consapevolmente.",
            status_code=403,
        )

    return await call_next(request)


def validate_local_path(
    value: str, *, repo_root: Path, must_exist: bool = False
) -> str:
    raw = value.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Path is required.")

    # Resolve the workspace root too: on Windows an unresolved root (e.g. an 8.3
    # short name like RUNNER~1) would not match the resolved candidate
    # (runneradmin), making relative_to wrongly reject valid in-workspace paths.
    root = repo_root.resolve()
    candidate = Path(raw)
    resolved = (
        candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
    )

    if not candidate.is_absolute() and not is_relative_to(resolved, root):
        raise HTTPException(
            status_code=400,
            detail="Relative paths must stay inside the DM-Instamap workspace.",
        )

    if is_broad_or_system_path(resolved):
        raise HTTPException(
            status_code=400,
            detail="Refusing broad or system path. Choose a specific local asset/reference folder.",
        )

    if must_exist and not resolved.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {value}")

    return str(resolved)


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def is_broad_or_system_path(path: Path) -> bool:
    home = Path.home().resolve()
    anchors = {Path(path.anchor).resolve()} if path.anchor else set()
    broad_paths = {home, *anchors}

    if path in broad_paths:
        return True

    if os.name == "nt":
        parts = {part.lower() for part in path.parts}
        if (
            "windows" in parts
            or "program files" in parts
            or "program files (x86)" in parts
        ):
            return True
    else:
        if path == Path("/"):
            return True
        system_prefixes = [
            Path("/bin"),
            Path("/boot"),
            Path("/dev"),
            Path("/etc"),
            Path("/proc"),
            Path("/sbin"),
            Path("/sys"),
        ]
        if any(
            path == prefix or is_relative_to(path, prefix) for prefix in system_prefixes
        ):
            return True

    return False
