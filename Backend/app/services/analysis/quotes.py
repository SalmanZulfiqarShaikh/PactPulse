"""Checking that a quoted clause really appears in the document.

The model is told to quote word for word, but nothing guaranteed it. Each
quote is searched for in the source text: first exactly (ignoring whitespace,
case and curly-vs-straight quotes), then fuzzily, which tolerates OCR noise and
small slips. The result carries character offsets into the original text, so
the UI can highlight the clause.
"""

from dataclasses import asdict, dataclass
from typing import Literal

from rapidfuzz import fuzz

type QuoteStatus = Literal["exact", "close", "not_found"]

_FUZZY_THRESHOLD = 90.0
_TRANSLATE = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " "})


@dataclass(frozen=True, slots=True)
class QuoteCheck:
    status: QuoteStatus
    start: int | None = None
    end: int | None = None
    score: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


class NormalisedText:
    """Text with whitespace collapsed, lowercased, punctuation unified, plus a
    map from each normalised character back to its index in the original."""

    def __init__(self, text: str) -> None:
        chars: list[str] = []
        origin: list[int] = []
        previous_space = True
        for index, char in enumerate(text.translate(_TRANSLATE)):
            if char.isspace():
                if previous_space:
                    continue
                char, previous_space = " ", True
            else:
                previous_space = False
            for lowered in char.lower():
                chars.append(lowered)
                origin.append(index)
        self.text = "".join(chars).rstrip()
        self.origin = origin[: len(self.text)]

    def original_span(self, start: int, end: int) -> tuple[int, int]:
        return self.origin[start], self.origin[end - 1] + 1


def locate_quote(quote: str, document: NormalisedText) -> QuoteCheck:
    needle = NormalisedText(quote).text
    if len(needle) < 12 or not document.text:
        return QuoteCheck("not_found")

    if (found := document.text.find(needle)) != -1:
        start, end = document.original_span(found, found + len(needle))
        return QuoteCheck("exact", start, end, 100.0)

    alignment = fuzz.partial_ratio_alignment(needle, document.text, score_cutoff=_FUZZY_THRESHOLD)
    if alignment and alignment.dest_end > alignment.dest_start:
        start, end = document.original_span(alignment.dest_start, alignment.dest_end)
        return QuoteCheck("close", start, end, round(alignment.score, 1))

    return QuoteCheck("not_found")


def check_quotes(insights: dict, text: str) -> dict:
    """Return ``insights`` with a ``quote_check`` added to every risk."""
    document = NormalisedText(text)
    risks = [
        {**risk, "quote_check": locate_quote(risk.get("clause_text") or "", document).to_dict()}
        for risk in insights.get("risks") or []
    ]
    return {**insights, "risks": risks}
