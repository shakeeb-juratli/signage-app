from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.user import User
from app.models.invitation import Invitation
from app.routers.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/team", tags=["team"])

FRONTEND_URL = "http://localhost:5173"


def effective_owner_id(user: User) -> int:
    return user.org_owner_id or user.id


def require_owner(current_user: User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Nur der Account-Inhaber kann das tun")
    return current_user


class InviteCreate(BaseModel):
    role: str  # editor | viewer


@router.post("/invite")
def create_invite(data: InviteCreate, current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    if data.role not in ("editor", "viewer"):
        raise HTTPException(status_code=400, detail="Rolle muss 'editor' oder 'viewer' sein")
    token = str(uuid.uuid4())
    invite = Invitation(
        token=token,
        org_owner_id=current_user.id,
        role=data.role,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invite)
    db.commit()
    return {"invite_url": f"{FRONTEND_URL}/?invite={token}", "role": data.role, "expires_days": 7}


@router.get("/invite/{token}")
def get_invite(token: str, db: Session = Depends(get_db)):
    invite = db.query(Invitation).filter(Invitation.token == token).first()
    if not invite or invite.used or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Einladung ungültig oder abgelaufen")
    owner = db.query(User).filter(User.id == invite.org_owner_id).first()
    return {"role": invite.role, "owner_email": owner.email if owner else ""}


class InviteAccept(BaseModel):
    email: str
    password: str


@router.post("/invite/{token}/accept")
def accept_invite(token: str, data: InviteAccept, db: Session = Depends(get_db)):
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    invite = db.query(Invitation).filter(Invitation.token == token).first()
    if not invite or invite.used or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Einladung ungültig oder abgelaufen")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")

    user = User(
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        role=invite.role,
        org_owner_id=invite.org_owner_id,
    )
    db.add(user)
    invite.used = True
    db.commit()
    return {"message": "Registrierung erfolgreich"}


@router.get("/members")
def list_members(current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    members = db.query(User).filter(User.org_owner_id == current_user.id).all()
    return [{"id": m.id, "email": m.email, "role": m.role} for m in members]


@router.put("/members/{user_id}")
def update_member_role(user_id: int, data: InviteCreate, current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    if data.role not in ("editor", "viewer"):
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    member = db.query(User).filter(User.id == user_id, User.org_owner_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    member.role = data.role
    db.commit()
    return {"message": "Rolle aktualisiert"}


@router.delete("/members/{user_id}")
def remove_member(user_id: int, current_user: User = Depends(require_owner), db: Session = Depends(get_db)):
    member = db.query(User).filter(User.id == user_id, User.org_owner_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")
    db.delete(member)
    db.commit()
    return {"message": "Mitglied entfernt"}
