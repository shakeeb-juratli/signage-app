from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Invitation(Base):
    __tablename__ = "invitations"

    id           = Column(Integer, primary_key=True, index=True)
    token        = Column(String, unique=True, nullable=False)
    org_owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role         = Column(String, nullable=False, default="editor")  # editor | viewer
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    expires_at   = Column(DateTime(timezone=True), nullable=False)
    used         = Column(Boolean, default=False)
