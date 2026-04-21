from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.models.schedule import Schedule
from app.models.playlist import Playlist
from app.models.screen import Screen
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/schedules", tags=["schedules"])

class ScheduleCreate(BaseModel):
    playlist_id: int
    days: List[int]       # 0=Mo … 6=So
    start_time: str       # "HH:MM"
    end_time: str         # "HH:MM"
    is_active: bool = True

class ScheduleResponse(BaseModel):
    id: int
    playlist_id: int
    days: List[int]
    start_time: str
    end_time: str
    is_active: bool

    class Config:
        from_attributes = True

def _check_ownership(playlist_id: int, db: Session, current_user: User) -> Playlist:
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist nicht gefunden")
    screen = db.query(Screen).filter(
        Screen.id == playlist.screen_id,
        Screen.owner_id == current_user.id
    ).first()
    if not screen:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    return playlist

@router.get("/playlist/{playlist_id}", response_model=list[ScheduleResponse])
def list_schedules(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_ownership(playlist_id, db, current_user)
    return db.query(Schedule).filter(Schedule.playlist_id == playlist_id).all()

@router.post("/", response_model=ScheduleResponse)
def create_schedule(
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_ownership(data.playlist_id, db, current_user)
    schedule = Schedule(
        playlist_id=data.playlist_id,
        days=data.days,
        start_time=data.start_time,
        end_time=data.end_time,
        is_active=data.is_active
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Zeitplan nicht gefunden")
    _check_ownership(schedule.playlist_id, db, current_user)
    schedule.days       = data.days
    schedule.start_time = data.start_time
    schedule.end_time   = data.end_time
    schedule.is_active  = data.is_active
    db.commit()
    db.refresh(schedule)
    return schedule

@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Zeitplan nicht gefunden")
    _check_ownership(schedule.playlist_id, db, current_user)
    db.delete(schedule)
    db.commit()
    return {"message": "Zeitplan gelöscht"}
