"""
Multi-bank PDF parsing service with password support.
Extraction pipeline: pdfplumber → PyMuPDF → fail (no OCR).
"""
import os
import tempfile
import logging
from typing import Optional, Tuple
from app.parsers.base import ParsedStatement
from app.parsers import PARSERS, GenericParser

logger = logging.getLogger(__name__)


def extract_text_pdfplumber(path: str, password: Optional[str] = None) -> str:
    import pdfplumber
    try:
        with pdfplumber.open(path, password=password) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}")
        return ""


def extract_text_pymupdf(path: str, password: Optional[str] = None) -> str:
    import fitz
    try:
        doc = fitz.open(path)
        if doc.is_encrypted:
            if password:
                doc.authenticate(password)
            else:
                raise ValueError("PDF is password protected")
        return "\n".join(page.get_text() for page in doc)
    except Exception as e:
        logger.warning(f"PyMuPDF failed: {e}")
        return ""


def decrypt_pdf(path: str, password: str) -> str:
    """Decrypt with pikepdf to a temp file, return temp path."""
    import pikepdf
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        with pikepdf.open(path, password=password) as pdf:
            pdf.save(tmp.name)
        return tmp.name
    except Exception as e:
        logger.warning(f"pikepdf decryption failed: {e}")
        tmp.close()
        os.unlink(tmp.name)
        return path


def extract_text(path: str, password: Optional[str] = None) -> Tuple[str, str]:
    """Extract text from PDF, returning (text, method_used)."""
    decrypted_path = path
    _temp_created = False

    if password:
        decrypted_path = decrypt_pdf(path, password)
        _temp_created = (decrypted_path != path)

    try:
        # Try pdfplumber first
        text = extract_text_pdfplumber(decrypted_path, password)
        if text and len(text.strip()) > 100:
            return text, "pdfplumber"

        # Try PyMuPDF
        text = extract_text_pymupdf(decrypted_path, password)
        if text and len(text.strip()) > 100:
            return text, "pymupdf"

        return "", "failed"
    finally:
        # Always clean up the plaintext decrypted temp file (BUG-007)
        if _temp_created and decrypted_path != path:
            try:
                os.unlink(decrypted_path)
            except OSError:
                pass


def detect_and_parse(text: str) -> ParsedStatement:
    """Auto-detect bank and parse statement."""
    for ParserClass in PARSERS:
        if ParserClass.can_parse(text):
            logger.info(f"Using parser: {ParserClass.bank_name}")
            return ParserClass().parse(text)

    # Fallback to generic
    logger.info("Using GenericParser as fallback")
    return GenericParser().parse(text)


def deduplicate_transactions(transactions: list) -> list:
    """Remove intra-PDF duplicate transactions.

    Uses full description (not truncated) so two same-amount same-day
    transactions from different merchants are not incorrectly collapsed.
    This dedup only fires within a single PDF parse — cross-source dedup
    is handled by the authority-based worker logic in tasks.py.
    """
    import hashlib as _hl
    seen: set = set()
    unique = []
    for tx in transactions:
        date_key = tx.date.date() if tx.date else None
        # Use SHA1 of full description to avoid truncation collisions (BUG-008)
        desc_hash = _hl.sha1(tx.description.encode("utf-8", errors="replace")).hexdigest()
        key = (date_key, str(tx.amount), tx.transaction_type, desc_hash)
        if key not in seen:
            seen.add(key)
            unique.append(tx)
    return unique


def parse_statement_pdf(file_path: str, password: Optional[str] = None) -> ParsedStatement:
    """Main entry point: extract text → detect bank → parse → deduplicate."""
    text, method = extract_text(file_path, password)
    logger.info(f"Text extracted via {method}, length={len(text)}")

    if not text:
        stmt = ParsedStatement(bank_name="UNKNOWN", raw_text="")
        stmt.parse_confidence = 0.0
        return stmt

    stmt = detect_and_parse(text)
    stmt.transactions = deduplicate_transactions(stmt.transactions)
    return stmt
