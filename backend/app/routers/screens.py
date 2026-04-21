from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.screen import Screen
from app.models.playlist import Playlist
from app.models.schedule import Schedule
from app.routers.auth import get_current_user
from app.models.user import User
from app.routers import ws as ws_module
from app.routers.team import effective_owner_id, require_owner

router = APIRouter(prefix="/screens", tags=["screens"])

class ScreenCreate(BaseModel):
    name: str
    location: Optional[str] = None
    city: Optional[str] = None

class ScreenResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]
    city: Optional[str]
    is_active: bool
    group_id: Optional[int] = None

    class Config:
        from_attributes = True

@router.get("/online-status")
def online_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"online": ws_module.get_online_screen_ids(db)}

@router.get("/", response_model=list[ScreenResponse])
def get_screens(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = effective_owner_id(current_user)
    return db.query(Screen).filter(Screen.owner_id == owner_id).all()

@router.post("/", response_model=ScreenResponse)
def create_screen(data: ScreenCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    screen = Screen(
        name=data.name,
        location=data.location,
        city=data.city,
        owner_id=current_user.id
    )
    db.add(screen)
    db.commit()
    db.refresh(screen)
    return screen

@router.put("/{screen_id}", response_model=ScreenResponse)
def update_screen(screen_id: int, data: ScreenCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    screen = db.query(Screen).filter(Screen.id == screen_id, Screen.owner_id == current_user.id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen nicht gefunden")
    screen.name     = data.name
    screen.location = data.location
    screen.city     = data.city
    db.commit()
    db.refresh(screen)
    return screen

@router.delete("/{screen_id}")
def delete_screen(screen_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    screen = db.query(Screen).filter(Screen.id == screen_id, Screen.owner_id == current_user.id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen nicht gefunden")
    db.delete(screen)
    db.commit()
    return {"message": "Screen gelöscht"}

@router.get("/{screen_id}/active-playlist")
def get_active_playlist(
    screen_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    screen = db.query(Screen).filter(Screen.id == screen_id, Screen.owner_id == current_user.id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen nicht gefunden")

    playlists = db.query(Playlist).filter(Playlist.screen_id == screen_id).all()
    group_playlists = (
        db.query(Playlist).filter(Playlist.group_id == screen.group_id).all()
        if screen.group_id else []
    )

    if not playlists and not group_playlists:
        return None

    now          = datetime.now()
    current_day  = now.weekday()
    current_time = now.strftime("%H:%M")

    def playlist_response(pl):
        return {
            "id": pl.id, "name": pl.name, "items": pl.items,
            "screen_name": screen.name, "screen_location": screen.location, "city": screen.city
        }

    all_ids = [pl.id for pl in playlists + group_playlists]
    all_schedules = (
        db.query(Schedule)
        .filter(Schedule.playlist_id.in_(all_ids), Schedule.is_active == True)
        .all()
    )
    schedules_by_playlist = {}
    for s in all_schedules:
        schedules_by_playlist.setdefault(s.playlist_id, []).append(s)

    def check_schedules(candidates):
        for pl in candidates:
            for s in schedules_by_playlist.get(pl.id, []):
                if current_day in s.days and s.start_time <= current_time <= s.end_time:
                    return pl
        return None

    def find_default(candidates):
        for pl in candidates:
            if pl.id not in schedules_by_playlist:
                return pl
        return None

    return (
        playlist_response(m) if (m := check_schedules(playlists)) else
        playlist_response(m) if (m := check_schedules(group_playlists)) else
        playlist_response(m) if (m := find_default(playlists)) else
        playlist_response(m) if (m := find_default(group_playlists)) else
        None
    )