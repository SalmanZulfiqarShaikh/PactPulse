"""Splitting long text at paragraph boundaries, with overlap."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Span:
    start: int
    end: int
    text: str


def split_text(text: str, limit: int, overlap: int, *, min_fill: float = 0.5) -> list[Span]:
    """Split ``text`` into spans of at most ``limit`` characters.

    Each span ends at the last paragraph break (then line break, then sentence
    end, then space) in the back half of its window, so a clause is not cut in
    half. Consecutive spans overlap by ``overlap`` characters so text near a
    boundary is seen whole at least once. Offsets index into ``text``, which is
    what lets the UI highlight a span in the original document.
    """
    if not text:
        return []
    if len(text) <= limit:
        return [Span(0, len(text), text)]

    spans: list[Span] = []
    start = 0
    while start < len(text):
        end = min(start + limit, len(text))
        if end < len(text):
            floor = start + int(limit * min_fill)
            for separator in ("\n\n", "\n", ". ", " "):
                cut = text.rfind(separator, floor, end)
                if cut != -1:
                    end = cut + len(separator)
                    break
        if chunk := text[start:end].strip():
            offset = start + (len(text[start:end]) - len(text[start:end].lstrip()))
            spans.append(Span(offset, offset + len(chunk), chunk))
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return spans
