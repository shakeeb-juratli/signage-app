from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pywebpush import webpush, WebPushException
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
import json

router = APIRouter(prefix="/notifications", tags=["notifications"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


def send_push(subscription_json: str, payload: dict):
    sub = json.loads(subscription_json)
    try:
        webpush(
            subscription_info=sub,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_EMAIL},
        )
    except WebPushException:
        pass


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(sub: PushSubscription, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.push_subscription = sub.model_dump_json()
    db.commit()
    return {"message": "Abonniert"}


@router.delete("/unsubscribe")
def unsubscribe(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.push_subscription = None
    db.commit()
    return {"message": "Abgemeldet"}


@router.post("/test")
def test_notification(current_user: User = Depends(get_current_user)):
    if not current_user.push_subscription:
        raise HTTPException(status_code=400, detail="Kein Push-Abonnement vorhanden")
    send_push(current_user.push_subscription, {
        "title": "Signage CMS",
        "body": "Push-Benachrichtigungen funktionieren! ✅",
    })
    return {"message": "Testbenachrichtigung gesendet"}
