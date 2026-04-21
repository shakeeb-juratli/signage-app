from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.user import User
from app.config import settings

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

class UserCreate(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

def create_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=401, detail="Ungültiger Token")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not pwd_context.verify(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Falsche Zugangsdaten")
    return {"access_token": create_token({"sub": user.email}), "token_type": "bearer"}


@router.post("/register")
@limiter.limit("5/minute")
def register(request: Request, data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    user = User(email=data.email, hashed_password=pwd_context.hash(data.password))
    db.add(user)
    db.commit()
    return {"message": "Registrierung erfolgreich"}

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "org_owner_id": current_user.org_owner_id,
        "created_at": current_user.created_at
    }

@router.put("/me/password")
def update_password(
    data: PasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not pwd_context.verify(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Altes Passwort ist falsch")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 6 Zeichen haben")
    current_user.hashed_password = pwd_context.hash(data.new_password)
    db.commit()
    return {"message": "Passwort erfolgreich geändert"}

class SettingsUpdate(BaseModel):
    openweather_key: Optional[str] = None

@router.get("/me/settings")
def get_settings(current_user: User = Depends(get_current_user)):
    return {
        "openweather_key": current_user.openweather_key or "",
        "drive_connected": current_user.google_token is not None
    }

@router.put("/me/settings")
def update_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.openweather_key = data.openweather_key or None
    db.commit()
    return {"message": "Einstellungen gespeichert"}

@router.delete("/me")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.delete(current_user)
    db.commit()
    return {"message": "Account gelöscht"}