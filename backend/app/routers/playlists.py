from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import asyncio

from app.database import get_db
from app.models.playlist import Playlist
from app.models.screen import Screen
from app.models.screen_group import ScreenGroup
from app.models.user import User
from app.routers.auth import get_current_user
from app.routers.ws import broadcast
from app.routers.team import effective_owner_id

def _get_authorized_playlist(playlist_id: int, current_user, db: Session):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist nicht gefunden")
    owner_id = effective_owner_id(current_user)
    if playlist.screen_id:
        screen = db.query(Screen).filter(Screen.id == playlist.screen_id, Screen.owner_id == owner_id).first()
        if not screen:
            raise HTTPException(status_code=403, detail="Keine Berechtigung")
    elif playlist.group_id:
        from app.models.screen_group import ScreenGroup
        group = db.query(ScreenGroup).filter(ScreenGroup.id == playlist.group_id, ScreenGroup.owner_id == owner_id).first()
        if not group:
            raise HTTPException(status_code=403, detail="Keine Berechtigung")
    return playlist

router = APIRouter(prefix="/playlists", tags=["playlists"])

class PlaylistItem(BaseModel):
    file_id: str
    name: str = ""
    duration: int = 10
    type: str = "image"

class PlaylistCreate(BaseModel):
    name: str
    screen_id: Optional[int] = None
    group_id: Optional[int] = None
    items: list[PlaylistItem] = []

class PlaylistResponse(BaseModel):
    id: int
    name: str
    screen_id: Optional[int] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    items: list
    city: Optional[str] = ""
    screen_name: Optional[str] = ""
    screen_location: Optional[str] = ""

    class Config:
        from_attributes = True

@router.get("/", response_model=list[PlaylistResponse])
def get_playlists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owner_id = effective_owner_id(current_user)
    screens = db.query(Screen).filter(Screen.owner_id == owner_id).all()
    screen_ids = [s.id for s in screens]
    groups = db.query(ScreenGroup).filter(ScreenGroup.owner_id == owner_id).all()
    group_ids = [g.id for g in groups]

    result = []

    # Screen-Playlists
    for pl in db.query(Playlist).filter(Playlist.screen_id.in_(screen_ids)).all():
        screen = next((s for s in screens if s.id == pl.screen_id), None)
        result.append({
            "id": pl.id, "name": pl.name,
            "screen_id": pl.screen_id, "group_id": None, "group_name": None,
            "items": pl.items or [],
            "city": screen.city if screen else "",
            "screen_name": screen.name if screen else "",
            "screen_location": screen.location if screen else ""
        })

    # Gruppen-Playlists
    if group_ids:
        for pl in db.query(Playlist).filter(Playlist.group_id.in_(group_ids)).all():
            group = next((g for g in groups if g.id == pl.group_id), None)
            result.append({
                "id": pl.id, "name": pl.name,
                "screen_id": None, "group_id": pl.group_id,
                "group_name": group.name if group else "",
                "items": pl.items or [],
                "city": "", "screen_name": "", "screen_location": ""
            })

    return result

@router.post("/", response_model=PlaylistResponse)
def create_playlist(data: PlaylistCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "viewer":
        raise HTTPException(status_code=403, detail="Viewer dürfen keine Playlists erstellen")
    owner_id = effective_owner_id(current_user)
    if data.screen_id:
        screen = db.query(Screen).filter(Screen.id == data.screen_id, Screen.owner_id == owner_id).first()
        if not screen:
            raise HTTPException(status_code=404, detail="Screen nicht gefunden")
    elif data.group_id:
        group = db.query(ScreenGroup).filter(ScreenGroup.id == data.group_id, ScreenGroup.owner_id == owner_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    else:
        raise HTTPException(status_code=400, detail="screen_id oder group_id erforderlich")

    playlist = Playlist(
        name=data.name,
        screen_id=data.screen_id,
        group_id=data.group_id,
        items=[item.dict() for item in data.items]
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    group_name = group.name if data.group_id else None
    return {
        "id": playlist.id, "name": playlist.name,
        "screen_id": playlist.screen_id, "group_id": playlist.group_id,
        "group_name": group_name, "items": playlist.items or [],
        "city": "", "screen_name": "", "screen_location": ""
    }

@router.post("/{playlist_id}/items")
async def add_item(playlist_id: int, item: PlaylistItem, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "viewer":
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    playlist = _get_authorized_playlist(playlist_id, current_user, db)
    items = list(playlist.items or [])
    items.append(item.dict())
    playlist.items = items
    db.commit()
    await notify_players(playlist, items, db)
    return {"message": "Datei hinzugefügt", "items": playlist.items}

@router.delete("/{playlist_id}/items/{item_index}")
async def remove_item(playlist_id: int, item_index: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "viewer":
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    playlist = _get_authorized_playlist(playlist_id, current_user, db)
    items = list(playlist.items or [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Item nicht gefunden")
    items.pop(item_index)
    playlist.items = items
    db.commit()
    await notify_players(playlist, items, db)
    return {"message": "Datei entfernt", "items": playlist.items}

@router.put("/{playlist_id}/items/reorder")
async def reorder_items(playlist_id: int, items: list[PlaylistItem], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "viewer":
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    playlist = _get_authorized_playlist(playlist_id, current_user, db)
    playlist.items = [item.dict() for item in items]
    db.commit()
    await notify_players(playlist, playlist.items, db)
    return {"message": "Reihenfolge aktualisiert"}

@router.delete("/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "viewer":
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    playlist = _get_authorized_playlist(playlist_id, current_user, db)
    db.delete(playlist)
    db.commit()
    return {"message": "Playlist gelöscht"}

async def notify_players(playlist: Playlist, items: list, db: Session):
    await broadcast(playlist.id, {"event": "playlist_updated", "items": items})
