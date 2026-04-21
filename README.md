# Signage App

A modern Digital Signage CMS built by [Telyro](https://telyro.com) — with Google Drive integration, real-time WebSocket updates, scheduling, multi-screen groups, team management, and push notifications.

## Features

- **CMS Dashboard** — Manage screens and playlists via React frontend
- **Google Drive Integration** — Use your own Google Drive for media storage
- **Playlist Scheduling** — Activate playlists automatically by day-of-week and time range
- **Multi-Screen Groups** — Control multiple screens simultaneously with priority cascade
- **Team Roles** — Invite teammates as Editor or Viewer via a shareable link
- **Real-time Updates** — WebSocket live sync between CMS and player
- **Signage Player** — Fullscreen player with smooth transitions, clock, and weather
- **Weather Widget** — Live weather per screen via OpenWeather API
- **Push Notifications** — Get notified when a player goes offline
- **Online/Offline Status** — See which players are currently connected
- **JWT Authentication** — Secure login with rate limiting and CORS protection
- **Docker Ready** — Full Docker and docker-compose setup

## Screenshots

### Login
![Login](docs/screenshots/login.png)

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Playlists
![Playlists](docs/screenshots/Playlists.png)

### Signage Player
![Player](docs/screenshots/Signage%20Player.png)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy |
| Frontend | React, Vite, Axios |
| Database | PostgreSQL |
| Auth | JWT |
| Realtime | WebSocket |
| Push | Web Push API / VAPID |
| Storage | Google Drive API |
| DevOps | Docker, Nginx |

## Installation

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
python migrate.py
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/signage
SECRET_KEY=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OPENWEATHER_API_KEY=your-openweather-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_EMAIL=mailto:you@example.com
ALLOWED_ORIGINS=http://localhost:5173
ENVIRONMENT=development
```

Generate VAPID keys:
```bash
python -c "
from py_vapid import Vapid
import base64
v = Vapid()
v.generate_keys()
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
pub = base64.urlsafe_b64encode(v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)).rstrip(b'=').decode()
priv = base64.urlsafe_b64encode(v.private_key.private_numbers().private_value.to_bytes(32, 'big')).rstrip(b'=').decode()
print('VAPID_PRIVATE_KEY=' + priv)
print('VAPID_PUBLIC_KEY=' + pub)
"
```

## Roadmap

- Mobile App (React Native)
- OneDrive and Dropbox support
- Analytics dashboard

## License

MIT — Copyright (c) 2026 [Telyro](https://telyro.com)
