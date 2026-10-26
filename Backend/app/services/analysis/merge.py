"""Combining per-chunk reports without a model call."""

from Backend.app.models.report import CheckItem, ClauseChecklist, ContractReport

_SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# When chunks disagree about a checklist item, the most informative answer wins:
# a problem anywhere is a problem; coverage anywhere beats silence.
_STATUS_RANK = {"needs_attention": 0, "fine": 1, "missing": 2, "not_applicable": 3}


def merge_checklists(checklists: list[ClauseChecklist]) -> ClauseChecklist:
    merged: dict[str, CheckItem] = {}
    for name in ClauseChecklist.model_fields:
        items = [getattr(checklist, name) for checklist in checklists]
        merged[name] = min(items, key=lambda item: _STATUS_RANK[item.status])
    return ClauseChecklist(**merged)


def _unique[T](items: list[T], key) -> list[T]:
    seen: set = set()
    result: list[T] = []
    for item in items:
        if (marker := key(item)) not in seen:
            seen.add(marker)
            result.append(item)
    return result


def merge_locally(partials: list[ContractReport]) -> ContractReport:
    """Concatenate and de-duplicate. Used when the merge call itself fails."""
    first = partials[0]
    risks = _unique(
        [risk for p in partials for risk in p.risks],
        key=lambda r: (r.title.strip().lower(), r.clause_text[:80].strip().lower()),
    )
    return ContractReport(
        # No model here to write one summary, so the partial ones are joined.
        tldr=" ".join(p.tldr.strip() for p in partials if p.tldr.strip()),
        what_this_means=_unique(
            [b for p in partials for b in p.what_this_means], key=lambda b: b.strip().lower()
        ),
        contract_type=first.contract_type,
        parties=first.parties,
        effective_date=first.effective_date,
        governing_law=first.governing_law,
        key_terms=_unique(
            [t for p in partials for t in p.key_terms], key=lambda t: t.term.strip().lower()
        ),
        obligations=_unique(
            [o for p in partials for o in p.obligations],
            key=lambda o: (o.party.strip().lower(), o.obligation.strip().lower()),
        ),
        risks=sorted(risks, key=lambda r: _SEVERITY_RANK.get(r.severity, 4)),
        checklist=merge_checklists([p.checklist for p in partials]),
    )
