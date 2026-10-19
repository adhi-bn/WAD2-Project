---
date: YYYY-MM-DD
adr-number: NNNN
status: Proposed
---

# NNNN. <Title>

**Status**: Proposed

## Context

Describe the context, problem statement, and forces at play. What problem are we solving? What technical, architectural, or business constraints exist? Why is a decision needed now?

## Decision

State the decision clearly and concisely. Explain what is being chosen, how it will be implemented, and any specific boundaries or constraints. Specify what is explicitly included and what is excluded.

## Alternatives Considered

Describe the alternatives evaluated and the reasons each was not chosen:
- **Alternative 1**: Description, pros, cons, and rationale for rejection.
- **Alternative 2**: Description, pros, cons, and rationale for rejection.

## Consequences

Summarize the positive outcomes, negative impacts, trade-offs, and downstream obligations resulting from this decision:
- **Positive**: What becomes easier, faster, or more robust?
- **Negative / Trade-offs**: What becomes more difficult, what technical debt or maintenance burden is incurred?
- **Neutral / Follow-ups**: What follow-up actions or migrations are needed?

---

### Usage Notes

- Copy this template to `docs/adr/NNNN-<short-title>.md` (e.g. `docs/adr/0003-part-catalogue-schema.md`).
- Increment the 4-digit number sequentially matching existing ADRs in `docs/adr/`.
- Use the domain vocabulary defined in `CONTEXT.md`. Avoid forbidden synonyms.
- If this decision supersedes or modifies an earlier ADR, update the earlier ADR's status (e.g. `Superseded by ADR-NNNN`) and explicitly reference it in the Context section.
- For agent and engineering workflow details on ADR consumption, refer to [docs/agents/domain.md](../agents/domain.md).
