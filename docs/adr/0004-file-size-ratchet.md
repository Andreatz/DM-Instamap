# 4. File-size ratchet instead of a hard cap

- Status: Accepted
- Date: 2026-05-23

## Context

A few modules had grown past 1000 lines, which increases the regression surface
and re-render cost. A hard line limit would either be too low to land or would
require splitting everything at once.

## Decision

`scripts/audit-file-size.mjs` enforces a ~700-line limit for non-test
application files, with a documented allowlist of current exceptions. Each
allowlisted file has a maximum (its current size) that it may not exceed: the
gate is a ratchet. Exceptions must be reduced and removed over time, not grown.
When a justified change pushes an allowlisted file up, the baseline is bumped
with a reason in the same commit.

## Consequences

- New files cannot silently balloon past the limit.
- Existing large files cannot grow further without an explicit, reviewed bump.
- The allowlist is a visible to-do list of modules still pending a split.
