from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.database import Base, engine
from app.routers import auth, screens, playlists, weather, drive, schedules, groups, notifications, team
from app.routers import ws
import os

Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Signage API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(screens.router)
app.include_router(playlists.router)
app.include_router(weather.router)
app.include_router(drive.router)
app.include_router(schedules.router)
app.include_router(groups.router)
app.include_router(notifications.router)
app.include_router(team.router)
app.include_router(ws.router)

player_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "player")
app.mount("/player", StaticFiles(directory=player_path, html=True), name="player")

@app.get("/")
def root():
    return {"status": "Signage API läuft ✅"}

@app.get("/debug/connections")
def debug_connections():
    from app.routers.ws import connections, screen_connections
    return {
        "by_playlist": {pid: len(sockets) for pid, sockets in connections.items()},
        "by_screen": {sid: len(sockets) for sid, sockets in screen_connections.items()},
    }
