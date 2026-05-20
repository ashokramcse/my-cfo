from app.parsers.base import BaseParser, ParsedStatement
from app.parsers.hdfc import HDFCParser
from app.parsers.icici import ICICIParser
from app.parsers.sbi import SBIParser
from app.parsers.axis import AxisParser
from app.parsers.cred import CredParser
from app.parsers.generic import GenericParser

PARSERS = [HDFCParser, ICICIParser, SBIParser, AxisParser]

__all__ = ["BaseParser", "ParsedStatement", "PARSERS", "CredParser", "GenericParser"]
