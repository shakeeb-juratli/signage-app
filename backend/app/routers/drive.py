from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from jose import jwt, JWTError
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
import io
import json
import os

if os.getenv("ENVIRONMENT", "development") == "development":
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

router = APIRouter(prefix="/drive", tags=["drive"])

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
REDIRECT_URI = "http://localhost:8000/drive/callback"

_code_verifiers = {}

def get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

def get_user_from_token(token: str, db: Session):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        return db.query(User).filter(User.email == email).first()
    except JWTError:
        return None

def get_credentials(current_user: User, db: Session = None):
    token_data = json.loads(current_user.google_token)
    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id", settings.GOOGLE_CLIENT_ID),
        client_secret=token_data.get("client_secret", settings.GOOGLE_CLIENT_SECRET),
        scopes=token_data.get("scopes", SCOPES)
    )
    if not token_data.get("refresh_token"):
        raise HTTPException(
            status_code=401,
            detail="Google Drive neu verbinden – kein Refresh-Token vorhanden"
        )
    if creds.expired or not creds.valid:
        try:
            creds.refresh(Request())
        except RefreshError:
            if db:
                current_user.google_token = None
                db.commit()
            raise HTTPException(
                status_code=401,
                detail="Google Drive Verbindung abgelaufen – bitte neu verbinden"
            )
        if db:
            current_user.google_token = creds.to_json()
            db.commit()
    return creds

@router.get("/auth")
def drive_auth(current_user: User = Depends(get_current_user)):
    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=str(current_user.id),
        prompt="consent"  # Erzwingt neuen refresh_token
    )
    _code_verifiers[str(current_user.id)] = flow.code_verifier
    return {"auth_url": auth_url}

@router.get("/callback")
def drive_callback(code: str, state: str, db: Session = Depends(get_db)):
    flow = get_flow()
    flow.fetch_token(code=code, code_verifier=_code_verifiers.get(state))
    credentials = flow.credentials
    user = db.query(User).filter(User.id == int(state)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    user.google_token = credentials.to_json()
    db.commit()
    return RedirectResponse("http://localhost:5173?drive=connected&from=profile")

@router.get("/status")
def drive_status(current_user: User = Depends(get_current_user)):
    return {"connected": current_user.google_token is not None}

@router.delete("/disconnect")
def drive_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.google_token = None
    db.commit()
    return {"message": "Google Drive getrennt"}

def _invalidate_token(user: User, db: Session):
    user.google_token = None
    db.commit()
    raise HTTPException(
        status_code=401,
        detail="Google Drive Verbindung abgelaufen – bitte neu verbinden"
    )

@router.get("/files")
def list_files(folder_id: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.google_token:
        raise HTTPException(status_code=400, detail="Google Drive nicht verbunden")

    try:
        service = build("drive", "v3", credentials=get_credentials(current_user, db))
        query = "mimeType contains 'image/' or mimeType contains 'video/'"
        if folder_id:
            query = f"'{folder_id}' in parents and ({query})"

        results = service.files().list(
            q=query,
            pageSize=50,
            fields="files(id, name, mimeType, thumbnailLink, size)"
        ).execute()
    except RefreshError:
        _invalidate_token(current_user, db)

    return [
        {
            "file_id": f["id"],
            "name": f["name"],
            "type": "video" if "video" in f["mimeType"] else "image",
            "thumbnail": f.get("thumbnailLink", ""),
            "size": f.get("size", 0)
        }
        for f in results.get("files", [])
    ]

@router.get("/media/{file_id}")
def stream_media(file_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    current_user = get_user_from_token(token, db)
    if not current_user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    if not current_user.google_token:
        raise HTTPException(status_code=400, detail="Google Drive nicht verbunden")

    try:
        service = build("drive", "v3", credentials=get_credentials(current_user, db))
        file_meta = service.files().get(fileId=file_id, fields="mimeType, name").execute()

        request = service.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    except RefreshError:
        _invalidate_token(current_user, db)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type=file_meta["mimeType"],
        headers={"Content-Disposition": f"inline; filename={file_meta['name']}"}
    )