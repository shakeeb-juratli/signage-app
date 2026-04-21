from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class ScreenGroup(Base):
    __tablename__ = "screen_groups"

    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner     = relationship("User")
    screens   = relationship("Screen", back_populates="group")
    playlists = relationship("Playlist", back_populates="group", cascade="all, delete-orphan")
