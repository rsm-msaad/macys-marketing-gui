"""Authentication for the slide editor.

Password is checked against a bcrypt hash stored in EDITOR_PASSWORD_HASH.
On success, returns a signed JWT token. The frontend stores it in
localStorage and sends it as a Bearer token in the Authorization header
for all editor API calls. This avoids cross-origin cookie issues between
the Vercel frontend and Render backend.
"""

from __future__ import annotations

import os
import time

import bcrypt
import jwt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"


def _secret() -> str:
    return os.environ.get("SESSION_SECRET", "dev-fallback-secret-change-me")


def _hash() -> str:
    return os.environ.get("EDITOR_PASSWORD_HASH", "")


def require_auth(authorization: str | None = Header(None)) -> dict:
    """FastAPI dependency that verifies the Bearer token.

    Usage: add Depends(require_auth) to any endpoint that needs auth.
    Raises 401 if the token is missing or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        if not payload.get("authenticated"):
            raise HTTPException(status_code=401, detail="Invalid session")
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")


class LoginBody(BaseModel):
    password: str


@router.post("/login")
def login(body: LoginBody) -> dict:
    stored_hash = _hash()
    if not stored_hash:
        raise HTTPException(
            status_code=503,
            detail="EDITOR_PASSWORD_HASH not configured on this deployment.",
        )

    if not bcrypt.checkpw(body.password.encode(), stored_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = jwt.encode(
        {"authenticated": True, "iat": int(time.time())},
        _secret(),
        algorithm=ALGORITHM,
    )
    return {"ok": True, "token": token}


@router.post("/logout")
def logout() -> dict:
    # Token based auth: client just deletes the token from localStorage.
    return {"ok": True}


@router.get("/check")
def check_auth(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        return {"authenticated": False}
    token = authorization[7:]
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
        return {"authenticated": bool(payload.get("authenticated"))}
    except jwt.InvalidTokenError:
        return {"authenticated": False}
