"""OCR for scanned PDFs, using Gemini's ability to read PDFs directly.

The PDF is split into batches of pages, transcribed concurrently, and joined
back in order, so a long scan does not hit the model's output limit.
"""

import asyncio
import io

from google.genai import types
from pypdf import PdfReader, PdfWriter

from Backend.app.core.config import settings
from Backend.app.prompts import ocr as prompts
from Backend.app.services.llm import generate_text


def _split_pdf(data: bytes, pages_per_batch: int) -> list[bytes]:
    reader = PdfReader(io.BytesIO(data))
    batches: list[bytes] = []
    for first in range(0, len(reader.pages), pages_per_batch):
        writer = PdfWriter()
        for page in reader.pages[first : first + pages_per_batch]:
            writer.add_page(page)
        buffer = io.BytesIO()
        writer.write(buffer)
        batches.append(buffer.getvalue())
    return batches


async def transcribe_pdf(data: bytes) -> str:
    batches = await asyncio.to_thread(_split_pdf, data, settings.upload.ocr_pages_per_request)
    limit = asyncio.Semaphore(settings.analysis.max_concurrent_chunks)

    async def transcribe(batch: bytes) -> str:
        async with limit:
            return await generate_text(
                [types.Part.from_bytes(data=batch, mime_type="application/pdf"), prompts.PROMPT],
                system=prompts.SYSTEM,
            )

    # TaskGroup cancels the remaining batches as soon as one fails.
    async with asyncio.TaskGroup() as group:
        tasks = [group.create_task(transcribe(batch)) for batch in batches]
    return "\n\n".join(task.result().strip() for task in tasks).strip()
