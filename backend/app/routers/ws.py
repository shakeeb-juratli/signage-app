from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.playlist import Playlist
from app.models.screen import Screen
from app.models.user import User
from app.routers.notifications import send_push
from app.routers.drive import get_user_from_token

router = APIRouter()

connections: dict[int, list[WebSocket]] = {}


def get_online_screen_ids(db: Session) -> list[int]:
    active_playlist_ids = [pid for pid, sockets in connections.items() if sockets]
    if not active_playlist_ids:
        return []
    rows = db.query(Playlist.screen_id).filter(
        Playlist.id.in_(active_playlist_ids),
        Playlist.screen_id.isnot(None)
    ).all()
    return list({r.screen_id for r in rows})


async def broadcast(playlist_id: int, message: dict):
    if playlist_id not in connections:
        return
    dead = []
    for ws in connections[playlist_id]:
        try:
            await ws.send_json(message)
        except:
            dead.append(ws)
    for ws in dead:
        connections[playlist_id].remove(ws)


def _notify_player_offline(playlist_id: int):
    db: Session = SessionLocal()
    try:
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist or not playlist.screen_id:
            return
        screen = db.query(Screen).filter(Screen.id == playlist.screen_id).first()
        if not screen:
            return
        owner = db.query(User).filter(User.id == screen.owner_id).first()
        if not owner or not owner.push_subscription:
            return
        send_push(owner.push_subscription, {
            "title": "Player offline",
            "body": f"📺 {screen.name} hat die Verbindung getrennt.",
        })
    finally:
        db.close()


@router.websocket("/ws/player/{playlist_id}")
async def websocket_player(websocket: WebSocket, playlist_id: int, token: str = Query(...)):
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
    finally:
        db.close()

    if not user:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    if playlist_id not in connections:
        connections[playlist_id] = []
    connections[playlist_id].append(websocket)

    print(f"Player verbunden: Playlist {playlist_id} — {len(connections[playlist_id])} aktiv")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections[playlist_id].remove(websocket)
        print(f"Player getrennt: Playlist {playlist_id}")
        _notify_player_offline(playlist_id)
