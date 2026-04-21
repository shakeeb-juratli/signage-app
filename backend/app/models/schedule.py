from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Schedule(Base):
    __tablename__ = "schedules"

    id          = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"))
    days        = Column(JSON, default=[])   # [0..6], 0=Montag, 6=Sonntag
    start_time  = Column(String, nullable=False)  # "HH:MM"
    end_time    = Column(String, nullable=False)  # "HH:MM"
    is_active   = Column(Boolean, default=True)

    playlist = relationship("Playlist", back_populates="schedules")
