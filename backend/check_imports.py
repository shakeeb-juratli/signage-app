import sys

steps = [
    ("fastapi",            "import fastapi"),
    ("sqlalchemy",         "import sqlalchemy"),
    ("passlib",            "from passlib.context import CryptContext"),
    ("jose",               "from jose import jwt"),
    ("pywebpush",          "from pywebpush import webpush"),
    ("slowapi",            "from slowapi import Limiter"),
    ("pydantic_settings",  "from pydantic_settings import BaseSettings"),
    ("google-auth",        "import google.auth"),
    ("app.config",         "from app.config import settings"),
    ("app.database",       "from app.database import Base, engine"),
    ("app.models.user",    "from app.models.user import User"),
    ("app.models.screen",  "from app.models.screen import Screen"),
    ("app.models.playlist","from app.models.playlist import Playlist"),
    ("app.models.invitation","from app.models.invitation import Invitation"),
    ("app.routers.auth",   "from app.routers import auth"),
    ("app.routers.screens","from app.routers import screens"),
    ("app.routers.ws",     "from app.routers import ws"),
    ("app.routers.notifications","from app.routers import notifications"),
    ("app.routers.team",   "from app.routers import team"),
    ("app.main",           "from app.main import app"),
]

for name, stmt in steps:
    try:
        exec(stmt)
        print(f"OK  {name}")
    except Exception as e:
        print(f"FAIL {name}: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)

print("All imports OK")
