# 2. Local-first, no built-in authentication

- Status: Accepted
- Date: 2026-05-23

## Context

DM-Instamap is a personal tool for preparing and running tabletop sessions. It
must work without cloud services, accounts, or paid APIs, and it handles local
files (assets, maps, campaigns) on the user's machine.

## Decision

The application is local-first and ships no authentication layer. By default it
binds to and only answers from `127.0.0.1`. Remote access is opt-in via
`DM_INSTAMAP_ALLOW_REMOTE=true`. When remote access is enabled, an optional IP
allowlist (`DM_INSTAMAP_ALLOWED_IPS`) and per-IP rate limit
(`DM_INSTAMAP_RATE_LIMIT_PER_MINUTE`) restrict LAN clients. The AI bridge is
optional: the manual copy/paste flow and a local mock provider work with no
network access.

## Consequences

- No login friction and no server to operate; the tool runs from a clone.
- Exposing it beyond localhost is a deliberate, documented choice with
  guardrails, never the default.
- Because there is no auth, all file-system access goes through one path
  validation policy (see [PATH_SECURITY.md](../PATH_SECURITY.md)) and untrusted
  imports are hardened against malformed input.
