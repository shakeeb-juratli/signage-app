from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Screen(Base):
    __tablename__ = "screens"

    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String, nullable=False)
    location  = Column(String, nullable=True)
    city      = Column(String, nullable=True, default="Wuppertal")
    is_active = Column(Boolean, default=True)
    owner_id  = Column(Integer, ForeignKey("users.id"))
    group_id  = Column(Integer, ForeignKey("screen_groups.id"), nullable=True)

    owner     = relationship("User")
    group     = relationship("ScreenGroup", back_populates="screens")
    playlists = relationship("Playlist", back_populates="screen")