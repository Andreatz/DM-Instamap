# 5. Personal-use license

- Status: Accepted
- Date: 2026-05-23

## Context

The project had no license, which under default copyright means no usage terms
are stated at all. DM-Instamap is built as a personal tool for the author's own
tabletop sessions, not as an open-source product.

## Decision

We ship a personal-use license (see [LICENSE](../../LICENSE)): copyright is
reserved, the author may use and modify the software for personal,
non-commercial purposes, and redistribution, sublicensing, commercial use, or
publication require prior written permission. Third-party dependencies keep
their own licenses. The root `package.json` is marked `private` with license
`UNLICENSED`.

## Consequences

- The terms of use are explicit instead of relying on implicit default
  copyright.
- The project is intentionally not open source; opening it later would require a
  new ADR and a license change.
- Contributions from others are not expected under these terms.
