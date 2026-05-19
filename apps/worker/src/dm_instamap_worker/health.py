def health_payload() -> dict[str, str]:
    return {
        "service": "dm-instamap-worker",
        "status": "ok",
        "mode": "local-first",
    }
