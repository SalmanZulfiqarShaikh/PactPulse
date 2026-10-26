from Backend.app.core.config import settings
from Backend.app.services.analysis.chunking import Span, split_text


def split_passages(text: str) -> list[Span]:
    """The document as overlapping ~1,200-character passages.

    Deterministic: the same text always yields the same passages, so passage
    numbers stored in Qdrant line up with the ones recomputed for read_passages.
    """
    cfg = settings.rag
    return split_text(text, cfg.passage_chars, cfg.passage_overlap_chars)
