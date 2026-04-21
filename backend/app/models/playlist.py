from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Playlist(Base):
    __tablename__ = "playlists"

    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String, nullable=False)
    screen_id = Column(Integer, ForeignKey("screens.id"), nullable=True)
    group_id  = Column(Integer, ForeignKey("screen_groups.id"), nullable=True)

    screen    = relationship("Screen", back_populates="playlists")
    group     = relationship("ScreenGroup", back_populates="playlists")
    items     = Column(JSON, default=[])
    schedules = relationship("Schedule", back_populates="playlist", cascade="all, delete-orphan")