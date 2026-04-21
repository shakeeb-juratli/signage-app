from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.screen_group import ScreenGroup
from app.models.screen import Screen
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])

class GroupCreate(BaseModel):
    name: str

class ScreenInfo(BaseModel):
    id: int
    name: str
    location: Optional[str] = None
    city: Optional[str] = None

    class Config:
        from_attributes = True

class GroupResponse(BaseModel):
    id: int
    name: str
    screens: list[ScreenInfo] = []

    class Config:
        from_attributes = True

def _own_group(group_id: int, db: Session, current_user: User) -> ScreenGroup:
    group = db.query(ScreenGroup).filter(
        ScreenGroup.id == group_id,
        ScreenGroup.owner_id == current_user.id
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    return group

@router.get("/", response_model=list[GroupResponse])
def list_groups(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ScreenGroup).filter(ScreenGroup.owner_id == current_user.id).all()

@router.post("/", response_model=GroupResponse)
def create_group(data: GroupCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = ScreenGroup(name=data.name, owner_id=current_user.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.put("/{group_id}", response_model=GroupResponse)
def update_group(group_id: int, data: GroupCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = _own_group(group_id, db, current_user)
    group.name = data.name
    db.commit()
    db.refresh(group)
    return group

@router.delete("/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = _own_group(group_id, db, current_user)
    db.query(Screen).filter(Screen.group_id == group.id).update({Screen.group_id: None})
    db.delete(group)
    db.commit()
    return {"message": "Gruppe gelöscht"}

@router.post("/{group_id}/screens/{screen_id}")
def add_screen_to_group(group_id: int, screen_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = _own_group(group_id, db, current_user)
    screen = db.query(Screen).filter(Screen.id == screen_id, Screen.owner_id == current_user.id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen nicht gefunden")
    screen.group_id = group.id
    db.commit()
    return {"message": f"Screen '{screen.name}' zur Gruppe '{group.name}' hinzugefügt"}

@router.delete("/{group_id}/screens/{screen_id}")
def remove_screen_from_group(group_id: int, screen_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _own_group(group_id, db, current_user)
    screen = db.query(Screen).filter(Screen.id == screen_id, Screen.owner_id == current_user.id).first()
    if not screen:
        raise HTTPException(status_code=404, detail="Screen nicht gefunden")
    screen.group_id = None
    db.commit()
    return {"message": f"Screen '{screen.name}' aus Gruppe entfernt"}
