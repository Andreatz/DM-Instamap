# Manual Test Report - Local Packaging

Date: 2026-05-22

Scope:

- `pnpm run doctor`
- `.env.local.example`
- Windows setup guide

Result:

- Automated unit coverage added for doctor version parsing and check
  classification.
- Manual full-machine setup still requires running on a clean Windows clone.

Notes:

- `pnpm run doctor` is intentionally local-only and performs no network checks.
- AI remains disabled by default; `AI_PROVIDER=mock` can be used for offline
  demos.
