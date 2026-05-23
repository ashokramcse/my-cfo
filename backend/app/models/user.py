from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    phone = Column(String(20))
    country = Column(String(3), default="IN")
    profile_bio = Column(Text)
    avatar_url = Column(Text)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    # Whether this account has completed email verification
    is_verified = Column(Boolean, default=True)
    currency = Column(String(3), default="INR")
    timezone = Column(String(50), default="Asia/Kolkata")
    monthly_budget = Column(String(20))  # encrypted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))

    cards = relationship("CreditCard", back_populates="user", cascade="all, delete-orphan")
    friends = relationship("Friend", back_populates="user", cascade="all, delete-orphan")
    statements = relationship("Statement", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    emis = relationship("EMI", back_populates="user", cascade="all, delete-orphan")
    insights = relationship("Insight", back_populates="user", cascade="all, delete-orphan")
    bank_accounts = relationship("BankAccount", back_populates="user", cascade="all, delete-orphan")
    bank_transactions = relationship("BankTransaction", back_populates="user", cascade="all, delete-orphan")
    investments = relationship("Investment", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="user", cascade="all, delete-orphan")
    net_worth_snapshots = relationship("NetWorthSnapshot", back_populates="user", cascade="all, delete-orphan")
    income_sources      = relationship("IncomeSource", back_populates="user", cascade="all, delete-orphan")
    income_entries      = relationship("IncomeEntry", back_populates="user", cascade="all, delete-orphan")
    insurances          = relationship("Insurance", back_populates="user", cascade="all, delete-orphan")
    goals               = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    ai_conversations    = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
    sessions            = relationship("UserSession", cascade="all, delete-orphan",
                                       foreign_keys="UserSession.user_id")
    relationships_owned = relationship("UserRelationship", cascade="all, delete-orphan",
                                       foreign_keys="UserRelationship.owner_id")
    share_permissions_given    = relationship("SharePermission", cascade="all, delete-orphan",
                                              foreign_keys="SharePermission.owner_id")
    share_permissions_received = relationship("SharePermission", cascade="all, delete-orphan",
                                              foreign_keys="SharePermission.grantee_id")
    invitations_sent     = relationship("ShareInvitation", cascade="all, delete-orphan",
                                        foreign_keys="ShareInvitation.inviter_id")
