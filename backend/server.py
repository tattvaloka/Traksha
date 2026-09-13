"""
TRAKSHA — Flagship application backend.

Domains: auth, identity (TMP/TRK + Day-45 transition), profile, privacy,
discovery/search, connections, QR & remote connection sessions, messaging,
communication context (personal/professional/hybrid), call availability &
call signaling, notifications, safety (block/report), Tattvaloka
(contributions/comments), account lifecycle, transition ceremony / vault.

Real-time (messaging, notifications, call signaling) runs over a single
authenticated WebSocket at /api/ws.
"""

import os
import asyncio
import logging
import secrets
import string
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Set, Any

import jwt
import requests
from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect,
    Query, Header, UploadFile, File, Form,
)
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("traksha")

# ---------------------------------------------------------------------------
# Config / infra
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_DAYS = 30
TMP_JOURNEY_DAYS = 45

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

ID_ALPHABET = string.ascii_uppercase + string.digits  # 36 symbols, non-sequential

# --- Emergent managed Object Storage (profile photos) ---------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "traksha"
_storage_key: Optional[str] = None


def init_storage(force: bool = False) -> Optional[str]:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage is not configured")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120,
    )
    if resp.status_code == 503:
        init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": _storage_key, "Content-Type": content_type}, data=data, timeout=120,
        )
    if resp.status_code == 402:
        raise HTTPException(402, "Storage quota reached")
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(404, "Not found")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": _storage_key}, timeout=60)
    if resp.status_code >= 400:
        raise HTTPException(404, "Not found")
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def gen_identity_code() -> str:
    """16-character cryptographically-random non-sequential identifier."""
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(16))


def new_id() -> str:
    return secrets.token_hex(12)


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(days=ACCESS_DAYS),
        "jti": secrets.token_urlsafe(12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# ---------------------------------------------------------------------------
# Lifespan: indexes, seed content, background scheduler
# ---------------------------------------------------------------------------
async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("identity_code")
    await db.qr_sessions.create_index("token", unique=True)
    await db.remote_sessions.create_index("token", unique=True)
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])


SEED_CONTRIBUTIONS = [
    {
        "title": "On accountable identity",
        "body": "Traksha begins from a simple civic idea: a person online should be able to act with the same accountability they carry in a public square. Identity here is not a costume; it is a commitment. The provisional stage exists so participation can begin immediately, while trust is established deliberately rather than instantly.",
        "author_name": "Tattvashila",
        "author_code": "TRKFOUNDATIONSEED",
    },
    {
        "title": "Consent is the whole architecture",
        "body": "Every connection in Traksha requires a request and an acceptance. Scanning a code, sharing a link, or finding someone in search never creates a relationship on its own. The other person decides. This single rule shapes messaging, calling, discoverability and blocking alike.",
        "author_name": "Tattvashila",
        "author_code": "TRKFOUNDATIONSEED",
    },
    {
        "title": "A place to participate, not just consume",
        "body": "Tattvaloka is ordered by recency and relevance to the reader, not by popularity, follower counts or engagement scores. There are no likes to farm and no streaks to protect. Read slowly. Reply when you have something to add.",
        "author_name": "Tattvashila",
        "author_code": "TRKFOUNDATIONSEED",
    },
]


async def seed_content():
    if await db.contributions.count_documents({}) == 0:
        base = now_utc()
        docs = []
        for i, c in enumerate(SEED_CONTRIBUTIONS):
            cid = new_id()
            docs.append({
                "_id": cid, "id": cid, "title": c["title"], "body": c["body"],
                "author_id": None, "author_name": c["author_name"],
                "author_code": c["author_code"],
                "created_at": base - timedelta(hours=i),
                "comment_count": 0, "deleted_at": None, "seed": True,
            })
        await db.contributions.insert_many(docs)
        logger.info("Seeded Tattvaloka content.")


async def run_transition(user: dict) -> Optional[dict]:
    """Atomically transition a due TMP user to TRK. Idempotent."""
    trk_code = gen_identity_code()
    ts = now_utc()
    updated = await db.users.find_one_and_update(
        {"_id": user["_id"], "identity_type": "TMP"},
        {"$set": {
            "identity_type": "TRK",
            "trk_code": trk_code,
            "identity_code": trk_code,
            "transition_at": ts,
            "transition_state": "PENDING",
        }},
        return_document=True,
    )
    if not updated:
        return None
    await db.identity_events.insert_one({
        "_id": new_id(), "user_id": user["_id"], "type": "TMP_TO_TRK",
        "tmp_code": user.get("tmp_code"), "trk_code": trk_code,
        "occurred_at": ts, "scheduled_for": user.get("transition_due_at"),
        "ceremony_viewed": False, "ceremony_state": "PENDING",
    })
    await create_notification(
        user["_id"], "identity_transition",
        "Your identity has been established",
        "You are now a verified TRK identity. Open to view your transition.",
        {"route": "/transition"},
    )
    logger.info("Transitioned user %s -> TRK", user["_id"])
    return updated


async def scheduler_loop():
    await asyncio.sleep(5)
    while True:
        try:
            cur = db.users.find({
                "identity_type": "TMP",
                "transition_due_at": {"$lte": now_utc()},
                "deleted_at": None,
            })
            async for u in cur:
                await run_transition(u)
        except Exception as e:  # noqa
            logger.error("scheduler error: %s", e)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    await seed_content()
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:  # noqa
        logger.error("storage init failed: %s", e)
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()
    client.close()


app = FastAPI(lifespan=lifespan, title="Traksha")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
async def get_user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("sub")
    except jwt.PyJWTError:
        return None
    if not uid:
        return None
    return await db.users.find_one({"_id": uid, "deleted_at": None})


async def require_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    u = await get_user_from_token(token)
    if not u:
        raise HTTPException(401, "Invalid or expired session")
    return u


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
def identity_label(u: dict) -> str:
    return f"{u['identity_type']}-{u['identity_code']}"


def public_profile(u: dict, viewer: Optional[dict] = None) -> dict:
    return {
        "id": u["_id"],
        "identity_code": u["identity_code"],
        "identity_type": u["identity_type"],
        "identity_label": identity_label(u),
        "display_name": u.get("display_name") or "Traksha member",
        "bio": u.get("bio"),
        "photo_url": u.get("photo_url"),
        "job_title": u.get("job_title"),
        "organization": u.get("organization"),
        "member_since": iso(u.get("created_at")),
        "verified": u["identity_type"] == "TRK",
    }


def journey_day(u: dict) -> Optional[int]:
    if u["identity_type"] != "TMP":
        return None
    created = u.get("created_at")
    if not created:
        return None
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    d = (now_utc() - created).days + 1
    return max(1, min(d, TMP_JOURNEY_DAYS))


def private_me(u: dict) -> dict:
    p = public_profile(u)
    p.update({
        "email": u["email"],
        "tmp_code": u.get("tmp_code"),
        "trk_code": u.get("trk_code"),
        "created_at": iso(u.get("created_at")),
        "transition_due_at": iso(u.get("transition_due_at")),
        "transition_at": iso(u.get("transition_at")),
        "transition_state": u.get("transition_state"),
        "privacy": u.get("privacy", {}),
        "availability": u.get("availability", {}),
        "day_of_journey": journey_day(u),
        "journey_length": TMP_JOURNEY_DAYS,
    })
    return p


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
def serialize_notification(n: dict) -> dict:
    return {
        "id": n["_id"], "kind": n["kind"], "title": n["title"], "body": n["body"],
        "data": n.get("data", {}), "read": n.get("read", False),
        "created_at": iso(n.get("created_at")),
    }


async def create_notification(user_id: str, kind: str, title: str, body: str,
                              data: Optional[dict] = None):
    doc = {
        "_id": new_id(), "user_id": user_id, "kind": kind, "title": title,
        "body": body, "data": data or {}, "read": False, "created_at": now_utc(),
    }
    await db.notifications.insert_one(doc)
    await ws_manager.send(user_id, {"type": "notification",
                                    "notification": serialize_notification(doc)})


# ---------------------------------------------------------------------------
# WebSocket manager
# ---------------------------------------------------------------------------
class WSManager:
    def __init__(self):
        self.conns: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.conns.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        s = self.conns.get(user_id)
        if s and ws in s:
            s.discard(ws)
            if not s:
                self.conns.pop(user_id, None)

    async def send(self, user_id: str, message: dict):
        for ws in list(self.conns.get(user_id, set())):
            try:
                await ws.send_json(message)
            except Exception:  # noqa
                self.disconnect(user_id, ws)

    def is_online(self, user_id: str) -> bool:
        return bool(self.conns.get(user_id))


ws_manager = WSManager()


# ===========================================================================
# AUTH
# ===========================================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


DEFAULT_PRIVACY = {
    "profile_visibility": "public",
    "discoverable": True,
    "allow_connection_requests": True,
}
DEFAULT_AVAILABILITY = {"audio_on": False, "video_on": False}


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account already exists for this email")
    tmp_code = gen_identity_code()
    created = now_utc()
    uid = new_id()
    user = {
        "_id": uid, "email": email, "password_hash": pwd.hash(body.password),
        "display_name": body.display_name.strip(),
        "identity_type": "TMP", "identity_code": tmp_code, "tmp_code": tmp_code,
        "trk_code": None, "created_at": created,
        "transition_due_at": created + timedelta(days=TMP_JOURNEY_DAYS),
        "transition_at": None, "transition_state": None,
        "bio": None, "photo_url": None, "job_title": None, "organization": None,
        "privacy": DEFAULT_PRIVACY.copy(), "availability": DEFAULT_AVAILABILITY.copy(),
        "deleted_at": None,
    }
    await db.users.insert_one(user)
    await db.identity_events.insert_one({
        "_id": new_id(), "user_id": uid, "type": "TMP_CREATED",
        "tmp_code": tmp_code, "occurred_at": created,
    })
    return {"access_token": make_token(uid), "user": private_me(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower(), "deleted_at": None})
    if not u or not pwd.verify(body.password, u["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": make_token(u["_id"]), "user": private_me(u)}


@api.post("/auth/logout")
async def logout(u: dict = Depends(require_user)):
    return {"ok": True}


@api.get("/auth/me")
async def me(u: dict = Depends(require_user)):
    return private_me(u)


@api.post("/auth/forgot-password")
async def forgot(body: ForgotIn):
    u = await db.users.find_one({"email": body.email.lower(), "deleted_at": None})
    resp = {"message": "If that email exists, a reset link has been sent."}
    if not u:
        return resp
    raw = secrets.token_urlsafe(24)
    await db.password_resets.insert_one({
        "_id": new_id(), "user_id": u["_id"], "token": raw,
        "expires_at": now_utc() + timedelta(minutes=30), "used": False,
    })
    resp["dev_reset_token"] = raw
    return resp


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_resets.find_one({"token": body.token, "used": False})
    if not rec or rec["expires_at"] <= now_utc():
        raise HTTPException(400, "Invalid or expired reset token")
    await db.password_resets.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    await db.users.update_one({"_id": rec["user_id"]},
                              {"$set": {"password_hash": pwd.hash(body.new_password)}})
    return {"message": "Password updated"}


# ===========================================================================
# IDENTITY / PROFILE / PRIVACY
# ===========================================================================
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=60)
    bio: Optional[str] = Field(default=None, max_length=280)
    photo_url: Optional[str] = None
    job_title: Optional[str] = Field(default=None, max_length=80)
    organization: Optional[str] = Field(default=None, max_length=80)


class PrivacyUpdate(BaseModel):
    profile_visibility: Optional[str] = None
    discoverable: Optional[bool] = None
    allow_connection_requests: Optional[bool] = None


class AvailabilityUpdate(BaseModel):
    audio_on: Optional[bool] = None
    video_on: Optional[bool] = None


@api.get("/identity/me")
async def identity_me(u: dict = Depends(require_user)):
    events = await db.identity_events.find({"user_id": u["_id"]}).sort("occurred_at", 1).to_list(50)
    return {
        "identity_type": u["identity_type"], "identity_code": u["identity_code"],
        "identity_label": identity_label(u), "tmp_code": u.get("tmp_code"),
        "trk_code": u.get("trk_code"), "created_at": iso(u.get("created_at")),
        "transition_due_at": iso(u.get("transition_due_at")),
        "transition_at": iso(u.get("transition_at")),
        "transition_state": u.get("transition_state"),
        "day_of_journey": journey_day(u), "journey_length": TMP_JOURNEY_DAYS,
        "history": [
            {"type": e["type"], "tmp_code": e.get("tmp_code"),
             "trk_code": e.get("trk_code"), "occurred_at": iso(e.get("occurred_at"))}
            for e in events
        ],
    }


@api.put("/profile/me")
async def update_profile(body: ProfileUpdate, u: dict = Depends(require_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"_id": u["_id"]}, {"$set": updates})
    u = await db.users.find_one({"_id": u["_id"]})
    return private_me(u)


ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic"}
MAX_PHOTO_BYTES = 8 * 1024 * 1024


@api.post("/profile/photo")
async def upload_profile_photo(file: UploadFile = File(...), u: dict = Depends(require_user)):
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(400, "Please choose a JPEG, PNG or WebP image")
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Image is too large (max 8MB)")
    path = f"{APP_NAME}/uploads/{u['_id']}/{new_id()}.{ext}"
    result = await run_in_threadpool(put_object, path, data, content_type)
    stored = result["path"]
    photo_url = f"/api/files/{stored}"
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"photo_url": photo_url, "photo_path": stored}})
    fresh = await db.users.find_one({"_id": u["_id"]})
    return private_me(fresh)


@api.get("/files/{path:path}")
async def serve_file(path: str):
    """Public read for profile photos (photos are public profile data)."""
    content, ctype = await run_in_threadpool(get_object, path)
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@api.put("/settings/privacy")
async def update_privacy(body: PrivacyUpdate, u: dict = Depends(require_user)):
    privacy = u.get("privacy", DEFAULT_PRIVACY.copy())
    for k, v in body.model_dump().items():
        if v is not None:
            privacy[k] = v
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"privacy": privacy}})
    return {"privacy": privacy}


@api.put("/settings/availability")
async def update_availability(body: AvailabilityUpdate, u: dict = Depends(require_user)):
    av = u.get("availability", DEFAULT_AVAILABILITY.copy())
    for k, v in body.model_dump().items():
        if v is not None:
            av[k] = v
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"availability": av}})
    return {"availability": av}


async def is_blocked_between(a: str, b: str) -> bool:
    n = await db.blocks.count_documents({
        "$or": [{"blocker": a, "blocked": b}, {"blocker": b, "blocked": a}]
    })
    return n > 0


@api.get("/profile/{identity_code}")
async def get_public_profile(identity_code: str, u: dict = Depends(require_user)):
    target = await db.users.find_one({"identity_code": identity_code, "deleted_at": None})
    if not target:
        raise HTTPException(404, "Profile not found")
    if await is_blocked_between(u["_id"], target["_id"]):
        raise HTTPException(404, "Profile not found")
    prof = public_profile(target, u)
    prof["relationship"] = await relationship_state(u["_id"], target["_id"])
    prof["allow_connection_requests"] = target.get("privacy", {}).get("allow_connection_requests", True)
    prof["is_self"] = target["_id"] == u["_id"]
    return prof


# ===========================================================================
# SEARCH / DISCOVERY
# ===========================================================================
@api.get("/search")
async def search(q: str = Query(default=""), type: str = Query(default="all"),
                 u: dict = Depends(require_user)):
    q = q.strip()
    result: Dict[str, Any] = {"people": [], "content": []}
    if not q:
        return result
    if type in ("people", "all"):
        blocked = await db.blocks.find({"$or": [{"blocker": u["_id"]}, {"blocked": u["_id"]}]}).to_list(500)
        excl = set()
        for b in blocked:
            excl.add(b["blocker"]); excl.add(b["blocked"])
        cur = db.users.find({
            "deleted_at": None, "privacy.discoverable": True,
            "$or": [
                {"display_name": {"$regex": q, "$options": "i"}},
                {"identity_code": {"$regex": q, "$options": "i"}},
            ],
        }).limit(25)
        async for p in cur:
            if p["_id"] == u["_id"] or p["_id"] in excl:
                continue
            result["people"].append(public_profile(p, u))
    if type in ("content", "all"):
        cur = db.contributions.find({
            "deleted_at": None,
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"body": {"$regex": q, "$options": "i"}},
            ],
        }).limit(25)
        async for c in cur:
            result["content"].append(serialize_contribution(c))
    return result


# ===========================================================================
# CONNECTIONS
# ===========================================================================
VALID_CONTEXTS = {"personal", "professional", "both"}


async def relationship_state(a: str, b: str) -> dict:
    conn = await db.connections.find_one({"members": {"$all": [a, b]}, "status": "connected"})
    if conn:
        return {"status": "connected", "connection_id": conn["_id"],
                "context": conn.get("context", "personal"),
                "note": (conn.get("notes") or {}).get(a)}
    req = await db.connection_requests.find_one({"from_id": a, "to_id": b, "status": "pending"})
    if req:
        return {"status": "outgoing", "request_id": req["_id"]}
    req = await db.connection_requests.find_one({"from_id": b, "to_id": a, "status": "pending"})
    if req:
        return {"status": "incoming", "request_id": req["_id"]}
    if await is_blocked_between(a, b):
        return {"status": "blocked"}
    return {"status": "none"}


def serialize_connection(c: dict, other: dict, me_id: str) -> dict:
    return {
        "id": c["_id"], "context": c.get("context", "personal"),
        "created_at": iso(c.get("created_at")), "other": public_profile(other),
        "note": (c.get("notes") or {}).get(me_id),
    }


def serialize_request(r: dict, other: dict, direction: str) -> dict:
    return {
        "id": r["_id"], "direction": direction, "source": r.get("source", "direct"),
        "context": r.get("context", "personal"), "message": r.get("message"),
        "created_at": iso(r.get("created_at")), "other": public_profile(other),
    }


class ConnectRequestIn(BaseModel):
    to_identity_code: str
    context: str = "personal"
    message: Optional[str] = Field(default=None, max_length=200)


@api.post("/connections/request")
async def send_connection_request(body: ConnectRequestIn, u: dict = Depends(require_user)):
    if body.context not in VALID_CONTEXTS:
        raise HTTPException(400, "Invalid context")
    target = await db.users.find_one({"identity_code": body.to_identity_code, "deleted_at": None})
    if not target:
        raise HTTPException(404, "Person not found")
    if target["_id"] == u["_id"]:
        raise HTTPException(400, "You cannot connect with yourself")
    if await is_blocked_between(u["_id"], target["_id"]):
        raise HTTPException(403, "This action is not available")
    if not target.get("privacy", {}).get("allow_connection_requests", True):
        raise HTTPException(403, "This person is not accepting connection requests")
    rel = await relationship_state(u["_id"], target["_id"])
    if rel["status"] == "connected":
        raise HTTPException(409, "You are already connected")
    if rel["status"] == "outgoing":
        raise HTTPException(409, "Request already sent")
    if rel["status"] == "incoming":
        raise HTTPException(409, "This person already sent you a request")
    pending = await db.connection_requests.count_documents({"from_id": u["_id"], "status": "pending"})
    if pending >= 20:
        raise HTTPException(429, "Too many pending requests")
    rid = new_id()
    req = {
        "_id": rid, "from_id": u["_id"], "to_id": target["_id"], "status": "pending",
        "context": body.context, "source": "direct", "message": body.message,
        "created_at": now_utc(),
    }
    await db.connection_requests.insert_one(req)
    await create_notification(
        target["_id"], "connection_request", "New connection request",
        f"{u.get('display_name')} would like to connect.", {"route": f"/requests/{rid}"})
    return serialize_request(req, target, "outgoing")


@api.get("/connections")
async def list_connections(u: dict = Depends(require_user)):
    out = []
    cur = db.connections.find({"members": u["_id"], "status": "connected"}).sort("created_at", -1)
    async for c in cur:
        other_id = [m for m in c["members"] if m != u["_id"]][0]
        other = await db.users.find_one({"_id": other_id})
        if other and not other.get("deleted_at"):
            out.append(serialize_connection(c, other, u["_id"]))
    return out


@api.get("/connections/requests")
async def list_requests(direction: str = Query(default="incoming"), u: dict = Depends(require_user)):
    out = []
    if direction == "incoming":
        cur = db.connection_requests.find({"to_id": u["_id"], "status": "pending"}).sort("created_at", -1)
        async for r in cur:
            other = await db.users.find_one({"_id": r["from_id"]})
            if other:
                out.append(serialize_request(r, other, "incoming"))
    else:
        cur = db.connection_requests.find({"from_id": u["_id"], "status": "pending"}).sort("created_at", -1)
        async for r in cur:
            other = await db.users.find_one({"_id": r["to_id"]})
            if other:
                out.append(serialize_request(r, other, "outgoing"))
    return out


@api.get("/connections/requests/{req_id}")
async def get_request(req_id: str, u: dict = Depends(require_user)):
    r = await db.connection_requests.find_one({"_id": req_id})
    if not r or u["_id"] not in (r["from_id"], r["to_id"]):
        raise HTTPException(404, "Request not found")
    direction = "incoming" if r["to_id"] == u["_id"] else "outgoing"
    other_id = r["from_id"] if direction == "incoming" else r["to_id"]
    other = await db.users.find_one({"_id": other_id})
    data = serialize_request(r, other, direction)
    data["status"] = r["status"]
    return data


async def establish_connection(req: dict) -> str:
    a, b = req["from_id"], req["to_id"]
    existing = await db.connections.find_one({"members": {"$all": [a, b]}})
    if existing:
        if existing["status"] != "connected":
            await db.connections.update_one({"_id": existing["_id"]},
                                            {"$set": {"status": "connected", "created_at": now_utc(),
                                                      "context": req.get("context", "personal")}})
        return existing["_id"]
    cid = new_id()
    await db.connections.insert_one({
        "_id": cid, "members": [a, b], "status": "connected",
        "context": req.get("context", "personal"), "created_at": now_utc(),
    })
    return cid


@api.post("/connections/requests/{req_id}/accept")
async def accept_request(req_id: str, u: dict = Depends(require_user)):
    r = await db.connection_requests.find_one({"_id": req_id, "to_id": u["_id"], "status": "pending"})
    if not r:
        raise HTTPException(404, "Request not found")
    await db.connection_requests.update_one({"_id": req_id}, {"$set": {"status": "accepted"}})
    cid = await establish_connection(r)
    await create_notification(
        r["from_id"], "connection_accepted", "Connection established",
        f"{u.get('display_name')} accepted your request.", {"route": "/(app)/connections"})
    return {"ok": True, "connection_id": cid}


@api.post("/connections/requests/{req_id}/decline")
async def decline_request(req_id: str, u: dict = Depends(require_user)):
    r = await db.connection_requests.find_one({"_id": req_id, "to_id": u["_id"], "status": "pending"})
    if not r:
        raise HTTPException(404, "Request not found")
    await db.connection_requests.update_one({"_id": req_id}, {"$set": {"status": "declined"}})
    return {"ok": True}


@api.post("/connections/requests/{req_id}/withdraw")
async def withdraw_request(req_id: str, u: dict = Depends(require_user)):
    r = await db.connection_requests.find_one({"_id": req_id, "from_id": u["_id"], "status": "pending"})
    if not r:
        raise HTTPException(404, "Request not found")
    await db.connection_requests.update_one({"_id": req_id}, {"$set": {"status": "withdrawn"}})
    return {"ok": True}


class ContextUpdate(BaseModel):
    context: str


@api.put("/connections/{conn_id}/context")
async def set_connection_context(conn_id: str, body: ContextUpdate, u: dict = Depends(require_user)):
    if body.context not in VALID_CONTEXTS:
        raise HTTPException(400, "Invalid context")
    c = await db.connections.find_one({"_id": conn_id, "members": u["_id"], "status": "connected"})
    if not c:
        raise HTTPException(404, "Connection not found")
    await db.connections.update_one({"_id": conn_id}, {"$set": {"context": body.context}})
    return {"ok": True, "context": body.context}


class NoteUpdate(BaseModel):
    note: str = Field(default="", max_length=1000)


@api.put("/connections/{conn_id}/note")
async def set_connection_note(conn_id: str, body: NoteUpdate, u: dict = Depends(require_user)):
    """A private note visible only to the viewer who wrote it."""
    c = await db.connections.find_one({"_id": conn_id, "members": u["_id"]})
    if not c:
        raise HTTPException(404, "Connection not found")
    note = body.note.strip()
    await db.connections.update_one({"_id": conn_id}, {"$set": {f"notes.{u['_id']}": note}})
    return {"ok": True, "note": note}


@api.delete("/connections/{conn_id}")
async def remove_connection(conn_id: str, u: dict = Depends(require_user)):
    c = await db.connections.find_one({"_id": conn_id, "members": u["_id"]})
    if not c:
        raise HTTPException(404, "Connection not found")
    await db.connections.update_one({"_id": conn_id}, {"$set": {"status": "removed"}})
    return {"ok": True}


# ===========================================================================
# QR + REMOTE CONNECTION SESSIONS
# ===========================================================================
QR_TTL_MIN = 5


@api.post("/qr/create")
async def create_qr(u: dict = Depends(require_user)):
    token = secrets.token_urlsafe(18)
    doc = {
        "_id": new_id(), "token": token, "owner": u["_id"], "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=QR_TTL_MIN), "revoked": False,
    }
    await db.qr_sessions.insert_one(doc)
    return {"token": token, "expires_at": iso(doc["expires_at"]), "ttl_minutes": QR_TTL_MIN,
            "session_id": doc["_id"], "identity_code": u["identity_code"]}


@api.post("/qr/revoke")
async def revoke_qr(u: dict = Depends(require_user)):
    await db.qr_sessions.update_many({"owner": u["_id"], "revoked": False}, {"$set": {"revoked": True}})
    return {"ok": True}


async def resolve_session(coll, token: str) -> dict:
    s = await coll.find_one({"token": token})
    if not s:
        raise HTTPException(404, "This code is not valid")
    if s.get("revoked"):
        raise HTTPException(410, "This code has been revoked")
    if s["expires_at"] <= now_utc():
        raise HTTPException(410, "This code has expired")
    return s


class TokenIn(BaseModel):
    token: str


class TokenContextIn(BaseModel):
    token: str
    context: str = "personal"
    message: Optional[str] = Field(default=None, max_length=200)


@api.post("/qr/scan")
async def scan_qr(body: TokenIn, u: dict = Depends(require_user)):
    """Validate + return an identity PREVIEW. Never establishes a connection."""
    s = await resolve_session(db.qr_sessions, body.token)
    owner = await db.users.find_one({"_id": s["owner"], "deleted_at": None})
    if not owner:
        raise HTTPException(404, "This code is not valid")
    if owner["_id"] == u["_id"]:
        raise HTTPException(400, "This is your own code")
    if await is_blocked_between(u["_id"], owner["_id"]):
        raise HTTPException(403, "This action is not available")
    prof = public_profile(owner, u)
    prof["relationship"] = await relationship_state(u["_id"], owner["_id"])
    return {"preview": prof, "token": body.token}


@api.post("/qr/connect")
async def connect_via_qr(body: TokenContextIn, u: dict = Depends(require_user)):
    s = await resolve_session(db.qr_sessions, body.token)
    owner = await db.users.find_one({"_id": s["owner"], "deleted_at": None})
    if not owner or owner["_id"] == u["_id"]:
        raise HTTPException(400, "This code is not valid")
    if await is_blocked_between(u["_id"], owner["_id"]):
        raise HTTPException(403, "This action is not available")
    rel = await relationship_state(u["_id"], owner["_id"])
    if rel["status"] == "connected":
        raise HTTPException(409, "You are already connected")
    if rel["status"] in ("outgoing", "incoming"):
        raise HTTPException(409, "A request already exists")
    rid = new_id()
    await db.connection_requests.insert_one({
        "_id": rid, "from_id": u["_id"], "to_id": owner["_id"], "status": "pending",
        "context": body.context if body.context in VALID_CONTEXTS else "personal",
        "source": "qr", "message": body.message, "created_at": now_utc(),
    })
    await create_notification(
        owner["_id"], "connection_request", "New connection request",
        f"{u.get('display_name')} scanned your code and wants to connect.",
        {"route": f"/requests/{rid}"})
    return {"ok": True, "request_id": rid}


@api.post("/remote/create")
async def create_remote(u: dict = Depends(require_user)):
    token = secrets.token_urlsafe(18)
    doc = {
        "_id": new_id(), "token": token, "owner": u["_id"], "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=QR_TTL_MIN), "revoked": False,
    }
    await db.remote_sessions.insert_one(doc)
    return {"token": token, "expires_at": iso(doc["expires_at"]), "ttl_minutes": QR_TTL_MIN}


@api.post("/remote/revoke")
async def revoke_remote(u: dict = Depends(require_user)):
    await db.remote_sessions.update_many({"owner": u["_id"], "revoked": False}, {"$set": {"revoked": True}})
    return {"ok": True}


@api.post("/remote/preview")
async def preview_remote(body: TokenIn, u: dict = Depends(require_user)):
    s = await resolve_session(db.remote_sessions, body.token)
    owner = await db.users.find_one({"_id": s["owner"], "deleted_at": None})
    if not owner or owner["_id"] == u["_id"]:
        raise HTTPException(400, "This link is not valid")
    prof = public_profile(owner, u)
    prof["relationship"] = await relationship_state(u["_id"], owner["_id"])
    return {"preview": prof, "token": body.token}


@api.post("/remote/submit")
async def submit_remote(body: TokenContextIn, u: dict = Depends(require_user)):
    s = await resolve_session(db.remote_sessions, body.token)
    owner = await db.users.find_one({"_id": s["owner"], "deleted_at": None})
    if not owner or owner["_id"] == u["_id"]:
        raise HTTPException(400, "This link is not valid")
    if await is_blocked_between(u["_id"], owner["_id"]):
        raise HTTPException(403, "This action is not available")
    rel = await relationship_state(u["_id"], owner["_id"])
    if rel["status"] == "connected":
        raise HTTPException(409, "You are already connected")
    if rel["status"] in ("outgoing", "incoming"):
        raise HTTPException(409, "A request already exists")
    rid = new_id()
    await db.connection_requests.insert_one({
        "_id": rid, "from_id": u["_id"], "to_id": owner["_id"], "status": "pending",
        "context": body.context if body.context in VALID_CONTEXTS else "personal",
        "source": "remote", "message": body.message, "created_at": now_utc(),
    })
    await create_notification(
        owner["_id"], "connection_request", "New connection request",
        f"{u.get('display_name')} used your connection link.", {"route": f"/requests/{rid}"})
    return {"ok": True, "request_id": rid}


# ===========================================================================
# MESSAGING
# ===========================================================================
def conversation_id_for(conn_id: str, context: str) -> str:
    return f"{conn_id}:{context}"


async def get_connection_for(u_id: str, conn_id: str) -> dict:
    c = await db.connections.find_one({"_id": conn_id, "members": u_id, "status": "connected"})
    if not c:
        raise HTTPException(403, "You are not connected")
    return c


def serialize_message(m: dict) -> dict:
    return {
        "id": m["_id"], "conversation_id": m["conversation_id"],
        "connection_id": m["connection_id"], "context": m["context"],
        "sender_id": m["sender_id"], "text": m["text"],
        "status": m.get("status", "sent"), "created_at": iso(m.get("created_at")),
        "client_id": m.get("client_id"),
        "type": m.get("type", "text"),
        "attachment": m.get("attachment"),
    }


@api.get("/conversations")
async def list_conversations(u: dict = Depends(require_user)):
    out = []
    cur = db.connections.find({"members": u["_id"], "status": "connected"})
    async for c in cur:
        other_id = [m for m in c["members"] if m != u["_id"]][0]
        other = await db.users.find_one({"_id": other_id})
        if not other or other.get("deleted_at"):
            continue
        ctx = c.get("context", "personal")
        contexts = ["personal", "professional"] if ctx == "both" else [ctx]
        for context in contexts:
            conv_id = conversation_id_for(c["_id"], context)
            last = await db.messages.find({"conversation_id": conv_id}).sort("created_at", -1).limit(1).to_list(1)
            unread = await db.messages.count_documents({
                "conversation_id": conv_id, "sender_id": other_id, "read": False})
            out.append({
                "conversation_id": conv_id, "connection_id": c["_id"], "context": context,
                "other": public_profile(other),
                "last_message": serialize_message(last[0]) if last else None,
                "unread": unread,
                "updated_at": iso(last[0]["created_at"]) if last else iso(c.get("created_at")),
            })
    out.sort(key=lambda x: x["updated_at"] or "", reverse=True)
    return out


@api.get("/conversations/{connection_id}/{context}/messages")
async def get_messages(connection_id: str, context: str, u: dict = Depends(require_user)):
    if context not in ("personal", "professional"):
        raise HTTPException(400, "Invalid context")
    c = await get_connection_for(u["_id"], connection_id)
    conv_id = conversation_id_for(connection_id, context)
    other_id = [m for m in c["members"] if m != u["_id"]][0]
    other = await db.users.find_one({"_id": other_id})
    msgs = await db.messages.find({"conversation_id": conv_id}).sort("created_at", 1).limit(500).to_list(500)
    await db.messages.update_many(
        {"conversation_id": conv_id, "sender_id": other_id, "read": False},
        {"$set": {"read": True}})
    return {
        "connection_id": connection_id, "context": context,
        "connection_context": c.get("context", "personal"),
        "other": public_profile(other) if other else None,
        "messages": [serialize_message(m) for m in msgs],
    }


class SendMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    context: str = "personal"
    client_id: Optional[str] = None


@api.post("/conversations/{connection_id}/messages")
async def send_message(connection_id: str, body: SendMessageIn, u: dict = Depends(require_user)):
    if body.context not in ("personal", "professional"):
        raise HTTPException(400, "Invalid context")
    c = await get_connection_for(u["_id"], connection_id)
    other_id = [m for m in c["members"] if m != u["_id"]][0]
    if await is_blocked_between(u["_id"], other_id):
        raise HTTPException(403, "This action is not available")
    conv_id = conversation_id_for(connection_id, body.context)
    mid = new_id()
    online = ws_manager.is_online(other_id)
    m = {
        "_id": mid, "conversation_id": conv_id, "connection_id": connection_id,
        "context": body.context, "sender_id": u["_id"], "text": body.text.strip(),
        "status": "delivered" if online else "sent", "read": False,
        "created_at": now_utc(), "client_id": body.client_id,
    }
    await db.messages.insert_one(m)
    payload = serialize_message(m)
    await ws_manager.send(other_id, {"type": "message", "message": payload})
    if not online:
        await create_notification(
            other_id, "message", f"New message from {u.get('display_name')}",
            body.text.strip()[:80], {"route": f"/conversation/{connection_id}/{body.context}"})
    return payload


# --- Attachments (images + documents) -------------------------------------
ATTACH_DOC_TYPES = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
}
MAX_ATTACH_BYTES = 20 * 1024 * 1024


@api.post("/conversations/{connection_id}/attachments")
async def upload_attachment(
    connection_id: str,
    file: UploadFile = File(...),
    context: str = Form("personal"),
    client_id: Optional[str] = Form(None),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    u: dict = Depends(require_user),
):
    if context not in ("personal", "professional"):
        raise HTTPException(400, "Invalid context")
    c = await get_connection_for(u["_id"], connection_id)
    other_id = [m for m in c["members"] if m != u["_id"]][0]
    if await is_blocked_between(u["_id"], other_id):
        raise HTTPException(403, "This action is not available")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type in ALLOWED_IMAGE_TYPES:
        kind, ext = "image", ALLOWED_IMAGE_TYPES[content_type]
    elif content_type in ATTACH_DOC_TYPES:
        kind, ext = "file", ATTACH_DOC_TYPES[content_type]
    else:
        raise HTTPException(415, "This file type is not supported")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "The file appears to be empty")
    if len(data) > MAX_ATTACH_BYTES:
        raise HTTPException(413, "File is too large (max 20MB)")

    mid = new_id()
    path = f"{APP_NAME}/attachments/{connection_id}/{mid}.{ext}"
    result = await run_in_threadpool(put_object, path, data, content_type)
    stored = result["path"]

    original_name = (file.filename or f"{kind}.{ext}").strip()[:180]
    attachment = {
        "url": f"/api/messages/{mid}/attachment",
        "kind": kind,
        "name": original_name,
        "size": len(data),
        "mime": content_type,
        "width": width,
        "height": height,
    }
    conv_id = conversation_id_for(connection_id, context)
    online = ws_manager.is_online(other_id)
    m = {
        "_id": mid, "conversation_id": conv_id, "connection_id": connection_id,
        "context": context, "sender_id": u["_id"], "text": "",
        "type": kind, "attachment": attachment, "attachment_storage": stored,
        "status": "delivered" if online else "sent", "read": False,
        "created_at": now_utc(), "client_id": client_id,
    }
    await db.messages.insert_one(m)
    payload = serialize_message(m)
    await ws_manager.send(other_id, {"type": "message", "message": payload})
    if not online:
        label = "Photo" if kind == "image" else original_name
        await create_notification(
            other_id, "message", f"New attachment from {u.get('display_name')}",
            label[:80], {"route": f"/conversation/{connection_id}/{context}"})
    return payload


@api.get("/messages/{message_id}/attachment")
async def serve_message_attachment(message_id: str, u: dict = Depends(require_user)):
    """Authorized attachment read — only connection members can fetch it."""
    m = await db.messages.find_one({"_id": message_id})
    if not m or not m.get("attachment_storage"):
        raise HTTPException(404, "Not found")
    c = await db.connections.find_one({"_id": m["connection_id"], "members": u["_id"]})
    if not c:
        raise HTTPException(403, "This action is not available")
    content, ctype = await run_in_threadpool(get_object, m["attachment_storage"])
    return Response(content=content, media_type=ctype,
                    headers={"Cache-Control": "private, max-age=86400"})


# ===========================================================================
# CALL AVAILABILITY + SIGNALING
# ===========================================================================
class AvailabilityRequestIn(BaseModel):
    to_identity_code: str
    kind: str = "audio"
    message: Optional[str] = Field(default=None, max_length=200)


@api.post("/calls/availability-request")
async def request_availability(body: AvailabilityRequestIn, u: dict = Depends(require_user)):
    target = await db.users.find_one({"identity_code": body.to_identity_code, "deleted_at": None})
    if not target:
        raise HTTPException(404, "Person not found")
    conn = await db.connections.find_one({"members": {"$all": [u["_id"], target["_id"]]}, "status": "connected"})
    if not conn:
        raise HTTPException(403, "You are not connected")
    rid = new_id()
    await db.availability_requests.insert_one({
        "_id": rid, "from_id": u["_id"], "to_id": target["_id"], "kind": body.kind,
        "message": body.message, "status": "pending", "created_at": now_utc(),
    })
    await create_notification(
        target["_id"], "call_availability_request", f"{body.kind.title()} availability request",
        f"{u.get('display_name')} is asking if you're available for a {body.kind} call.",
        {"route": f"/availability/{rid}"})
    return {"ok": True, "request_id": rid}


@api.get("/calls/availability-request/{rid}")
async def get_availability_request(rid: str, u: dict = Depends(require_user)):
    r = await db.availability_requests.find_one({"_id": rid})
    if not r or u["_id"] not in (r["from_id"], r["to_id"]):
        raise HTTPException(404, "Request not found")
    other = await db.users.find_one({"_id": r["from_id"] if r["to_id"] == u["_id"] else r["to_id"]})
    return {
        "id": r["_id"], "kind": r["kind"], "message": r.get("message"),
        "status": r["status"], "created_at": iso(r["created_at"]),
        "direction": "incoming" if r["to_id"] == u["_id"] else "outgoing",
        "other": public_profile(other) if other else None,
        "window_minutes": r.get("window_minutes"),
    }


class AcceptAvailabilityIn(BaseModel):
    window_minutes: int = 20


@api.post("/calls/availability-request/{rid}/accept")
async def accept_availability(rid: str, body: AcceptAvailabilityIn, u: dict = Depends(require_user)):
    r = await db.availability_requests.find_one({"_id": rid, "to_id": u["_id"], "status": "pending"})
    if not r:
        raise HTTPException(404, "Request not found")
    window_end = now_utc() + timedelta(minutes=body.window_minutes)
    await db.availability_requests.update_one(
        {"_id": rid}, {"$set": {"status": "accepted", "window_minutes": body.window_minutes,
                                "window_end": window_end}})
    await db.availability_windows.insert_one({
        "_id": new_id(), "members": [r["from_id"], r["to_id"]], "kind": r["kind"],
        "expires_at": window_end, "created_at": now_utc(),
    })
    await create_notification(
        r["from_id"], "call_availability_request", "Availability granted",
        f"{u.get('display_name')} is available for {body.window_minutes} minutes.",
        {"route": f"/availability/{rid}"})
    return {"ok": True, "window_end": iso(window_end)}


@api.post("/calls/availability-request/{rid}/decline")
async def decline_availability(rid: str, u: dict = Depends(require_user)):
    r = await db.availability_requests.find_one({"_id": rid, "to_id": u["_id"], "status": "pending"})
    if not r:
        raise HTTPException(404, "Request not found")
    await db.availability_requests.update_one({"_id": rid}, {"$set": {"status": "declined"}})
    return {"ok": True}


@api.get("/calls/can-call/{identity_code}")
async def can_call(identity_code: str, kind: str = "audio", u: dict = Depends(require_user)):
    target = await db.users.find_one({"identity_code": identity_code, "deleted_at": None})
    if not target:
        raise HTTPException(404, "Person not found")
    conn = await db.connections.find_one({"members": {"$all": [u["_id"], target["_id"]]}, "status": "connected"})
    if not conn:
        raise HTTPException(403, "You are not connected")
    field = "audio_on" if kind == "audio" else "video_on"
    always_on = target.get("availability", {}).get(field, False)
    win = await db.availability_windows.find_one({
        "members": {"$all": [u["_id"], target["_id"]]}, "expires_at": {"$gt": now_utc()}})
    can = bool(always_on or win)
    return {"can_call": can, "reason": "available" if can else "unavailable",
            "target": public_profile(target)}


# ===========================================================================
# NOTIFICATIONS
# ===========================================================================
@api.get("/notifications")
async def list_notifications(u: dict = Depends(require_user)):
    cur = db.notifications.find({"user_id": u["_id"]}).sort("created_at", -1).limit(100)
    items = [serialize_notification(n) async for n in cur]
    unread = await db.notifications.count_documents({"user_id": u["_id"], "read": False})
    return {"items": items, "unread": unread}


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, u: dict = Depends(require_user)):
    await db.notifications.update_one({"_id": nid, "user_id": u["_id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all_notifications(u: dict = Depends(require_user)):
    await db.notifications.update_many({"user_id": u["_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ===========================================================================
# SAFETY: BLOCK + REPORT
# ===========================================================================
class BlockIn(BaseModel):
    identity_code: str


@api.post("/blocks")
async def block_user(body: BlockIn, u: dict = Depends(require_user)):
    target = await db.users.find_one({"identity_code": body.identity_code})
    if not target or target["_id"] == u["_id"]:
        raise HTTPException(400, "Cannot block this identity")
    if not await db.blocks.find_one({"blocker": u["_id"], "blocked": target["_id"]}):
        await db.blocks.insert_one({
            "_id": new_id(), "blocker": u["_id"], "blocked": target["_id"], "created_at": now_utc()})
    await db.connections.update_many(
        {"members": {"$all": [u["_id"], target["_id"]]}}, {"$set": {"status": "removed"}})
    await db.connection_requests.update_many(
        {"$or": [{"from_id": u["_id"], "to_id": target["_id"]},
                 {"from_id": target["_id"], "to_id": u["_id"]}], "status": "pending"},
        {"$set": {"status": "cancelled"}})
    return {"ok": True}


@api.delete("/blocks/{identity_code}")
async def unblock_user(identity_code: str, u: dict = Depends(require_user)):
    target = await db.users.find_one({"identity_code": identity_code})
    if target:
        await db.blocks.delete_many({"blocker": u["_id"], "blocked": target["_id"]})
    return {"ok": True}


@api.get("/blocks")
async def list_blocks(u: dict = Depends(require_user)):
    out = []
    cur = db.blocks.find({"blocker": u["_id"]}).sort("created_at", -1)
    async for b in cur:
        t = await db.users.find_one({"_id": b["blocked"]})
        if t:
            out.append(public_profile(t))
    return out


REPORT_REASONS = ["harassment", "spam", "impersonation", "abusive_behavior", "serious_violation"]


class ReportIn(BaseModel):
    target_type: str
    target_id: str
    reason: str
    detail: Optional[str] = Field(default=None, max_length=500)


@api.get("/reports/reasons")
async def report_reasons():
    return {"reasons": REPORT_REASONS}


@api.post("/reports")
async def submit_report(body: ReportIn, u: dict = Depends(require_user)):
    if body.reason not in REPORT_REASONS:
        raise HTTPException(400, "Invalid reason")
    await db.reports.insert_one({
        "_id": new_id(), "reporter": u["_id"], "target_type": body.target_type,
        "target_id": body.target_id, "reason": body.reason, "detail": body.detail,
        "status": "received", "created_at": now_utc()})
    return {"ok": True, "message": "Report received"}


# ===========================================================================
# TATTVALOKA
# ===========================================================================
def serialize_contribution(c: dict) -> dict:
    return {
        "id": c["_id"], "title": c["title"], "body": c["body"],
        "author_name": c.get("author_name"), "author_code": c.get("author_code"),
        "author_id": c.get("author_id"), "created_at": iso(c.get("created_at")),
        "comment_count": c.get("comment_count", 0),
    }


@api.get("/contributions")
async def list_contributions(u: dict = Depends(require_user)):
    cur = db.contributions.find({"deleted_at": None, "status": {"$ne": "draft"}}).sort("created_at", -1).limit(50)
    return [serialize_contribution(c) async for c in cur]


@api.get("/contributions/{cid}")
async def get_contribution(cid: str, u: dict = Depends(require_user)):
    c = await db.contributions.find_one({"_id": cid, "deleted_at": None})
    if not c:
        raise HTTPException(404, "Contribution not found")
    if c.get("status") == "draft" and c.get("author_id") != u["_id"]:
        raise HTTPException(404, "Contribution not found")
    return serialize_contribution(c)


class ContributionIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    body: str = Field(min_length=1, max_length=8000)


@api.post("/contributions")
async def create_contribution(body: ContributionIn, u: dict = Depends(require_user)):
    if u["identity_type"] != "TRK":
        raise HTTPException(403, "Publishing is available once your identity is established (TRK).")
    cid = new_id()
    doc = {
        "_id": cid, "id": cid, "title": body.title.strip(), "body": body.body.strip(),
        "author_id": u["_id"], "author_name": u.get("display_name"),
        "author_code": u["identity_code"], "created_at": now_utc(),
        "comment_count": 0, "deleted_at": None, "status": "published",
    }
    await db.contributions.insert_one(doc)
    return serialize_contribution(doc)


# --- Contribution drafts (TRK) --------------------------------------------
class DraftIn(BaseModel):
    title: str = Field(default="", max_length=140)
    body: str = Field(default="", max_length=8000)


def serialize_draft(c: dict) -> dict:
    return {
        "id": c["_id"], "title": c.get("title", ""), "body": c.get("body", ""),
        "updated_at": iso(c.get("updated_at") or c.get("created_at")),
        "status": "draft",
    }


@api.get("/drafts")
async def list_drafts(u: dict = Depends(require_user)):
    cur = db.contributions.find({"author_id": u["_id"], "status": "draft", "deleted_at": None}).sort("updated_at", -1).limit(50)
    return [serialize_draft(c) async for c in cur]


@api.post("/drafts")
async def create_draft(body: DraftIn, u: dict = Depends(require_user)):
    if u["identity_type"] != "TRK":
        raise HTTPException(403, "Drafts are available once your identity is established (TRK).")
    cid = new_id()
    doc = {
        "_id": cid, "id": cid, "title": body.title.strip(), "body": body.body.strip(),
        "author_id": u["_id"], "author_name": u.get("display_name"),
        "author_code": u["identity_code"], "created_at": now_utc(), "updated_at": now_utc(),
        "comment_count": 0, "deleted_at": None, "status": "draft",
    }
    await db.contributions.insert_one(doc)
    return serialize_draft(doc)


@api.get("/drafts/{did}")
async def get_draft(did: str, u: dict = Depends(require_user)):
    c = await db.contributions.find_one({"_id": did, "author_id": u["_id"], "status": "draft", "deleted_at": None})
    if not c:
        raise HTTPException(404, "Draft not found")
    return serialize_draft(c)


@api.put("/drafts/{did}")
async def update_draft(did: str, body: DraftIn, u: dict = Depends(require_user)):
    c = await db.contributions.find_one({"_id": did, "author_id": u["_id"], "status": "draft", "deleted_at": None})
    if not c:
        raise HTTPException(404, "Draft not found")
    await db.contributions.update_one({"_id": did}, {"$set": {"title": body.title.strip(), "body": body.body.strip(), "updated_at": now_utc()}})
    fresh = await db.contributions.find_one({"_id": did})
    return serialize_draft(fresh)


@api.delete("/drafts/{did}")
async def delete_draft(did: str, u: dict = Depends(require_user)):
    c = await db.contributions.find_one({"_id": did, "author_id": u["_id"], "status": "draft"})
    if not c:
        raise HTTPException(404, "Draft not found")
    await db.contributions.update_one({"_id": did}, {"$set": {"deleted_at": now_utc()}})
    return {"ok": True}


@api.post("/drafts/{did}/publish")
async def publish_draft(did: str, u: dict = Depends(require_user)):
    if u["identity_type"] != "TRK":
        raise HTTPException(403, "Publishing is available once your identity is established (TRK).")
    c = await db.contributions.find_one({"_id": did, "author_id": u["_id"], "status": "draft", "deleted_at": None})
    if not c:
        raise HTTPException(404, "Draft not found")
    if not (c.get("title") or "").strip() or not (c.get("body") or "").strip():
        raise HTTPException(400, "A title and body are required to publish")
    await db.contributions.update_one({"_id": did}, {"$set": {"status": "published", "created_at": now_utc()}})
    fresh = await db.contributions.find_one({"_id": did})
    return serialize_contribution(fresh)


def serialize_comment(c: dict) -> dict:
    return {
        "id": c["_id"], "body": c["body"], "author_id": c.get("author_id"),
        "author_name": c.get("author_name"), "author_code": c.get("author_code"),
        "created_at": iso(c.get("created_at")),
    }


@api.get("/contributions/{cid}/comments")
async def list_comments(cid: str, u: dict = Depends(require_user)):
    cur = db.comments.find({"contribution_id": cid, "deleted_at": None}).sort("created_at", 1).limit(200)
    return [serialize_comment(c) async for c in cur]


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@api.post("/contributions/{cid}/comments")
async def add_comment(cid: str, body: CommentIn, u: dict = Depends(require_user)):
    c = await db.contributions.find_one({"_id": cid, "deleted_at": None})
    if not c:
        raise HTTPException(404, "Contribution not found")
    doc = {
        "_id": new_id(), "contribution_id": cid, "body": body.body.strip(),
        "author_id": u["_id"], "author_name": u.get("display_name"),
        "author_code": u["identity_code"], "created_at": now_utc(), "deleted_at": None,
    }
    await db.comments.insert_one(doc)
    await db.contributions.update_one({"_id": cid}, {"$inc": {"comment_count": 1}})
    return serialize_comment(doc)


# ===========================================================================
# TRANSITION CEREMONY / VAULT
# ===========================================================================
@api.get("/transition")
async def get_transition(u: dict = Depends(require_user)):
    ev = await db.identity_events.find_one({"user_id": u["_id"], "type": "TMP_TO_TRK"})
    if not ev:
        return {"available": False}
    return {
        "available": True, "tmp_code": ev.get("tmp_code"), "trk_code": ev.get("trk_code"),
        "occurred_at": iso(ev.get("occurred_at")),
        "ceremony_viewed": ev.get("ceremony_viewed", False),
        "ceremony_state": ev.get("ceremony_state", "PENDING"),
    }


@api.post("/transition/complete")
async def complete_transition(u: dict = Depends(require_user)):
    await db.identity_events.update_one(
        {"user_id": u["_id"], "type": "TMP_TO_TRK"},
        {"$set": {"ceremony_viewed": True, "ceremony_state": "VIEWED", "viewed_at": now_utc()}})
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"transition_state": "COMPLETE"}})
    return {"ok": True}


# ===========================================================================
# ACCOUNT LIFECYCLE + DEV TOOLS
# ===========================================================================
@api.delete("/account")
async def delete_account(u: dict = Depends(require_user)):
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"deleted_at": now_utc()}})
    await db.connections.update_many({"members": u["_id"]}, {"$set": {"status": "removed"}})
    return {"ok": True}


@api.post("/dev/simulate-transition")
async def simulate_transition(u: dict = Depends(require_user)):
    """Testing helper: instantly run the Day-45 transition for the current user."""
    if u["identity_type"] != "TMP":
        raise HTTPException(400, "Already a TRK identity")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"transition_due_at": now_utc()}})
    fresh = await db.users.find_one({"_id": u["_id"]})
    updated = await run_transition(fresh)
    if not updated:
        raise HTTPException(500, "Transition failed")
    return {"ok": True, "trk_code": updated.get("trk_code")}


@api.get("/")
async def root():
    return {"app": "Traksha", "status": "ok"}


# ===========================================================================
# WEBSOCKET
# ===========================================================================
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(default="")):
    user = await get_user_from_token(token)
    if not user:
        await ws.close(code=4401)
        return
    uid = user["_id"]
    await ws_manager.connect(uid, ws)
    try:
        while True:
            data = await ws.receive_json()
            mtype = data.get("type")
            if mtype in ("call:invite", "call:accept", "call:decline", "call:end", "call:signal"):
                to_code = data.get("to")
                target = await db.users.find_one({"identity_code": to_code, "deleted_at": None}) if to_code else None
                if not target:
                    continue
                conn = await db.connections.find_one({
                    "members": {"$all": [uid, target["_id"]]}, "status": "connected"})
                if not conn or await is_blocked_between(uid, target["_id"]):
                    await ws.send_json({"type": "call:error", "reason": "not_allowed"})
                    continue
                relay = dict(data)
                relay["from"] = user["identity_code"]
                relay["from_name"] = user.get("display_name")
                await ws_manager.send(target["_id"], relay)
                if mtype == "call:invite" and not ws_manager.is_online(target["_id"]):
                    await create_notification(
                        target["_id"], "call", f"Missed {data.get('kind', 'audio')} call",
                        f"{user.get('display_name')} tried to call you.", {"route": "/(app)/messages"})
            elif mtype == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(uid, ws)
    except Exception as e:  # noqa
        logger.error("ws error: %s", e)
        ws_manager.disconnect(uid, ws)


app.include_router(api)
