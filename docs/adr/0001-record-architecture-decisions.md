# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-05-23

## Context

DM-Instamap is maintained by a single author over a long time. Decisions about
architecture, tooling and policy tend to be forgotten, and the reasoning behind
them is hard to reconstruct from the code alone.

## Decision

We keep lightweight Architecture Decision Records in `docs/adr/`. Each record is
a numbered Markdown file describing the context, the decision, and its
consequences. New decisions that replace old ones are added as new ADRs that
mark the previous one as Superseded, rather than editing it in place.

## Consequences

- The rationale behind non-obvious choices stays close to the repository.
- The overhead is small: ADRs are short and only written for decisions worth
  remembering.
- The index in `docs/adr/README.md` must be updated when an ADR is added.
