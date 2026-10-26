"""Turn an uploaded file into text, falling back to OCR for scanned PDFs."""

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path

from Backend.app.core.config import settings
from Backend.app.models.contract import TextSource
from Backend.app.services.documents.ocr import transcribe_pdf
from Backend.app.services.documents.parser import PARSERS, DocumentParseError
from Backend.app.services.llm import LLMError

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ExtractedDocument:
    text: str
    page_count: int
    source: TextSource

    @property
    def word_count(self) -> int:
        return len(self.text.split())


def _looks_scanned(text: str, page_count: int) -> bool:
    return len(text) < settings.upload.ocr_min_chars_per_page * max(1, page_count)


async def extract_document(filename: str, data: bytes) -> ExtractedDocument:
    suffix = Path(filename).suffix.lower()
    if (parser := PARSERS.get(suffix)) is None:
        raise DocumentParseError(
            f"We can't read {suffix or 'this'} files. Upload a PDF, Word (.docx) or text file."
        )

    parsed = await asyncio.to_thread(parser, data)

    if suffix == ".pdf" and _looks_scanned(parsed.text, parsed.page_count):
        try:
            text = await transcribe_pdf(data)
        except* LLMError as group:
            logger.warning("OCR failed: %s", group.exceptions[0])
            raise DocumentParseError(
                "This looks like a scanned PDF, and we couldn't read it right now. "
                "Please try again in a few minutes."
            ) from None
        if text:
            return ExtractedDocument(text, parsed.page_count, TextSource.OCR)

    if not parsed.text:
        raise DocumentParseError("We couldn't find any text in this file.")

    return ExtractedDocument(parsed.text, parsed.page_count, TextSource.TEXT_LAYER)
