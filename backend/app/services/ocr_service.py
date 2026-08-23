"""
OCR fallback for scanned/image-only PDFs (no extractable text layer).
Uses pdf2image to rasterize pages + pytesseract for OCR.
Both are optional at import time so the app still boots if system
binaries (poppler, tesseract) aren't installed — OCR is skipped with
a clear log message instead of crashing resume processing.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import pytesseract
    from pdf2image import convert_from_path
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    _OCR_AVAILABLE = True
except Exception as e:  # pragma: no cover - environment dependent
    _OCR_AVAILABLE = False
    logger.warning("OCR dependencies not available (%s). Scanned PDFs will not be OCR'd.", e)


def is_ocr_available() -> bool:
    return _OCR_AVAILABLE and settings.OCR_ENABLED


def ocr_pdf(file_path: str, max_pages: int = 10) -> Optional[str]:
    """Rasterize a PDF's pages and run OCR on each. Returns concatenated text
    or None if OCR isn't available / fails."""
    if not is_ocr_available():
        return None
    try:
        images = convert_from_path(file_path, dpi=200)
        text_chunks = []
        for page in images[:max_pages]:
            text_chunks.append(pytesseract.image_to_string(page))
        return "\n".join(text_chunks).strip()
    except Exception as e:
        logger.error("OCR failed for %s: %s", file_path, e)
        return None
