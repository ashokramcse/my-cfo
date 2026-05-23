"""
FinancialEntity — the "pocket" concept.

Allows a user to separate personal finances from business entities
(sole proprietorship, Pvt Ltd, HUF, partnership). All major financial
objects (bank accounts, investments, loans, assets) can be tagged with
an entity_id to enable dual-pocket P&L separation.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class EntityType(str, enum.Enum):
    PERSONAL     = "PERSONAL"
    SOLE_PROP    = "SOLE_PROP"      # Sole Proprietorship
    PRIVATE_LTD  = "PRIVATE_LTD"   # Pvt Ltd company
    LLP          = "LLP"
    HUF          = "HUF"           # Hindu Undivided Family
    PARTNERSHIP  = "PARTNERSHIP"
    TRUST        = "TRUST"
    OTHER        = "OTHER"


class FinancialEntity(Base):
    __tablename__ = "financial_entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # FK set in migration

    entity_type  = Column(SAEnum(EntityType), nullable=False, default=EntityType.PERSONAL)
    entity_name  = Column(String(200), nullable=False)    # "Personal", "Ashok Traders", "ABC Pvt Ltd"
    pan          = Column(String(10))                     # PAN of entity
    gstin        = Column(String(15))                     # GST registration
    cin          = Column(String(21))                     # Company Identification Number (Pvt Ltd)
    description  = Column(Text)

    is_default   = Column(Boolean, default=False)         # one entity is the default for new records
    is_active    = Column(Boolean, default=True)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())
