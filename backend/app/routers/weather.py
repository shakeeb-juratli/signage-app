from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import httpx
from app.config import settings
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/weather", tags=["weather"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def _get_api_key(token: str, db: Session) -> str:
    if token:
        try:
            from jose import jwt
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user = db.query(User).filter(User.email == payload.get("sub")).first()
            if user and user.openweather_key:
                return user.openweather_key
        except Exception:
            pass
    return settings.OPENWEATHER_API_KEY

@router.get("/search")
async def search_cities(
    q: str = Query(..., min_length=2),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    api_key = _get_api_key(token, db)
    async with httpx.AsyncClient() as client:
        if api_key:
            res = await client.get(
                "http://api.openweathermap.org/geo/1.0/direct",
                params={"q": q, "limit": 5, "appid": api_key}
            )
            if res.status_code == 200:
                return [
                    {"name": c["name"], "country": c.get("country", ""), "state": c.get("state", "")}
                    for c in res.json()
                ]

        # Fallback: OpenStreetMap Nominatim (kein API-Key nötig)
        res = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 5, "addressdetails": 1, "featuretype": "settlement"},
            headers={"User-Agent": "SignageCMS/1.0"}
        )
        if res.status_code != 200:
            return []
        results = []
        seen = set()
        for c in res.json():
            addr = c.get("address", {})
            name = addr.get("city") or addr.get("town") or addr.get("village") or c.get("name", "")
            state = addr.get("state", "")
            country = addr.get("country_code", "").upper()
            key = (name, country)
            if name and key not in seen:
                seen.add(key)
                results.append({"name": name, "country": country, "state": state})
        return results

@router.get("/{city}")
async def get_weather(
    city: str,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    api_key = _get_api_key(token, db)
    if not api_key:
        return {
            "city": city, "temperature": "–",
            "description": "Kein API-Key", "icon": "", "humidity": 0, "wind": 0
        }

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": api_key, "units": "metric", "lang": "de"}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Stadt nicht gefunden")
        data = response.json()

    return {
        "city": data["name"],
        "temperature": round(data["main"]["temp"]),
        "description": data["weather"][0]["description"],
        "icon": data["weather"][0]["icon"],
        "humidity": data["main"]["humidity"],
        "wind": round(data["wind"]["speed"] * 3.6),  # m/s → km/h
        "timezone": data.get("timezone", 0),          # seconds offset from UTC
    }