from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, Text, Enum as SAEnum, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class AssetType(str, enum.Enum):
    REAL_ESTATE = "REAL_ESTATE"
    VEHICLE = "VEHICLE"
    JEWELRY = "JEWELRY"
    ELECTRONICS = "ELECTRONICS"
    FURNITURE = "FURNITURE"
    ARTWORK = "ARTWORK"
    OTHER = "OTHER"


class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    asset_type = Column(SAEnum(AssetType), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)

    # Valuation
    purchase_price = Column(Numeric(15, 2))
    current_value = Column(Numeric(15, 2), nullable=False)
    purchase_date = Column(Date)

    # Depreciation
    depreciation_rate = Column(Numeric(5, 2), default=0)  # annual % for vehicles, electronics
    depreciation_method = Column(String(20), default="NONE")  # NONE, STRAIGHT_LINE, DECLINING

    # Location (for real estate)
    location = Column(String(300))
    area_sqft = Column(Numeric(10, 2))

    # Vehicle
    registration_number = Column(String(50))
    make_model = Column(String(200))
    year_of_manufacture = Column(Integer)

    # Insurance
    is_insured = Column(Boolean, default=False)
    insurance_expiry = Column(Date)
    insurance_value = Column(Numeric(15, 2))

    # Ownership
    ownership_docs = Column(String(200))  # document reference
    is_mortgaged = Column(Boolean, default=False)
    mortgage_outstanding = Column(Numeric(15, 2), default=0)

    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="assets")
