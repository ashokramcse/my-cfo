"""
Image-to-statement parsing pipeline.
Handles Cred screenshots (PNG/JPG/WEBP) and any other CC app screenshots.
Pipeline: PIL load → preprocess → Tesseract OCR → detect bank → parse.
"""
import logging
from typing import Tuple
from app.parsers.base import ParsedStatement
from app.parsers.cred import CredParser
from app.parsers import PARSERS
from app.services.pdf_parser import deduplicate_transactions, detect_and_parse

logger = logging.getLogger(__name__)

SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}


def is_image_file(filename: str) -> bool:
    import os
    return os.path.splitext(filename.lower())[1] in SUPPORTED_IMAGE_EXTENSIONS


def preprocess_image(image):
    """Enhance screenshot for better OCR accuracy."""
    from PIL import Image, ImageEnhance, ImageFilter
    import numpy as np

    # Convert to RGB if needed (handles RGBA screenshots)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    # Upscale small screenshots — Tesseract works best at ~300 DPI equivalent
    w, h = image.size
    if w < 1000:
        scale = 1000 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Grayscale
    gray = image.convert("L")

    # Boost contrast
    gray = ImageEnhance.Contrast(gray).enhance(2.0)

    # Mild sharpening
    gray = gray.filter(ImageFilter.SHARPEN)

    return gray


def extract_text_from_image(image_path: str) -> Tuple[str, str]:
    """
    Extract text from an image file using Tesseract OCR.
    Returns (text, method).
    """
    try:
        from PIL import Image
        import pytesseract

        image = Image.open(image_path)
        processed = preprocess_image(image)

        # PSM 4 = single column of text (good for mobile screenshots)
        # PSM 6 = uniform block (fallback)
        config_main = "--psm 4 -l eng"
        text = pytesseract.image_to_string(processed, config=config_main)

        if len(text.strip()) < 30:
            # Fallback: try original without preprocessing
            text = pytesseract.image_to_string(image, config="--psm 6 -l eng")

        return text.strip(), "tesseract"

    except ImportError:
        logger.error("pytesseract or Pillow not installed")
        return "", "failed"
    except Exception as e:
        logger.error(f"Image OCR failed: {e}")
        return "", "failed"


def detect_and_parse_image(text: str) -> ParsedStatement:
    """
    Try Cred parser first (most common screenshot source),
    then fall back to the standard bank parser chain.
    """
    # Cred parser gets priority — its patterns are screenshot-specific
    if CredParser.can_parse(text):
        logger.info("Using CredParser")
        return CredParser().parse(text)

    # Try standard bank parsers (some users screenshot internet banking too)
    return detect_and_parse(text)


def parse_statement_image(file_path: str) -> ParsedStatement:
    """Main entry point: image file → ParsedStatement."""
    text, method = extract_text_from_image(file_path)
    logger.info(f"Image OCR via {method}, extracted {len(text)} chars")

    if not text:
        stmt = ParsedStatement(bank_name="UNKNOWN", raw_text="")
        stmt.parse_confidence = 0.0
        return stmt

    stmt = detect_and_parse_image(text)
    stmt.transactions = deduplicate_transactions(stmt.transactions)
    return stmt
