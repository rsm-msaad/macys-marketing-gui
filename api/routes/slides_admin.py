"""Slide editor API: CRUD for the storyboard slides.json.

Reads and writes gui/public/storyboard/slides.json on disk. When
GITHUB_PAT is set, changes are also committed to the personal mirror
repo so Vercel auto deploys them.
"""

from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from api.routes.auth import require_auth

router = APIRouter(prefix="/api/slides", tags=["slides"])

REPO_ROOT = Path(__file__).resolve().parents[2]
SLIDES_JSON = REPO_ROOT / "gui" / "public" / "storyboard" / "slides.json"
SCENES_DIR = REPO_ROOT / "gui" / "public" / "storyboard" / "scenes"
GITHUB_REPO = "rsm-msaad/macys-marketing-gui"
GITHUB_API = "https://api.github.com"


def _load() -> list[dict[str, Any]]:
    if not SLIDES_JSON.exists():
        return []
    return json.loads(SLIDES_JSON.read_text(encoding="utf-8"))


def _save(slides: list[dict[str, Any]]) -> None:
    SLIDES_JSON.write_text(
        json.dumps(slides, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _github_pat() -> str | None:
    pat = os.environ.get("GITHUB_PAT", "")
    return pat if pat and not pat.startswith("your_") else None


def _commit_to_github(file_path: str, content_bytes: bytes, message: str) -> dict | None:
    """Commit a single file to the personal mirror via GitHub API. Returns commit info or None."""
    pat = _github_pat()
    if not pat:
        return None
    headers = {
        "Authorization": f"Bearer {pat}",
        "Accept": "application/vnd.github+json",
    }
    # Get current SHA if file exists
    url = f"{GITHUB_API}/repos/{GITHUB_REPO}/contents/{file_path}"
    try:
        resp = httpx.get(url, headers=headers, timeout=15)
        sha = resp.json().get("sha") if resp.status_code == 200 else None
    except Exception:
        sha = None

    body: dict[str, Any] = {
        "message": message,
        "content": base64.b64encode(content_bytes).decode("ascii"),
        "branch": "main",
    }
    if sha:
        body["sha"] = sha

    try:
        resp = httpx.put(url, headers=headers, json=body, timeout=30)
        if resp.status_code in (200, 201):
            data = resp.json()
            return {
                "sha": data.get("commit", {}).get("sha", ""),
                "url": data.get("commit", {}).get("html_url", ""),
            }
        return {"error": f"GitHub API {resp.status_code}: {resp.text[:200]}"}
    except Exception as exc:
        return {"error": str(exc)}


def _commit_slides(message: str) -> dict | None:
    """Commit the current slides.json to GitHub."""
    content = SLIDES_JSON.read_bytes()
    return _commit_to_github("gui/public/storyboard/slides.json", content, message)


# --- Endpoints ---


@router.get("")
def list_slides() -> dict:
    return {"slides": _load(), "total": len(_load())}


@router.post("/reorder")
def reorder_slides(body: dict, _auth: dict = Depends(require_auth)) -> dict:
    order = body.get("order", [])
    if not order:
        raise HTTPException(status_code=400, detail="order list required")
    slides = _load()
    id_map = {s["id"]: s for s in slides}
    reordered = []
    for sid in order:
        if sid in id_map:
            reordered.append(id_map[sid])
    # Re-number
    for i, s in enumerate(reordered):
        s["id"] = i + 1
    _save(reordered)
    commit = _commit_slides("reorder storyboard slides")
    return {"ok": True, "total": len(reordered), "github": commit}


@router.post("/{slide_id}/update")
def update_slide(slide_id: int, body: dict, _auth: dict = Depends(require_auth)) -> dict:
    slides = _load()
    found = None
    for s in slides:
        if s["id"] == slide_id:
            found = s
            break
    if not found:
        raise HTTPException(status_code=404, detail=f"slide {slide_id} not found")
    if "notes" in body:
        found["notes"] = body["notes"]
    if "title" in body:
        found["title"] = body["title"]
    if "subtitle" in body:
        found["subtitle"] = body["subtitle"]
    _save(slides)
    commit = _commit_slides(f"update notes for slide {slide_id}")
    return {"ok": True, "slide": found, "github": commit}


@router.delete("/{slide_id}")
def delete_slide(slide_id: int, _auth: dict = Depends(require_auth)) -> dict:
    slides = _load()
    before = len(slides)
    slides = [s for s in slides if s["id"] != slide_id]
    if len(slides) == before:
        raise HTTPException(status_code=404, detail=f"slide {slide_id} not found")
    # Re-number
    for i, s in enumerate(slides):
        s["id"] = i + 1
    _save(slides)
    commit = _commit_slides(f"delete slide {slide_id}")
    return {"ok": True, "total": len(slides), "github": commit}


@router.post("/add")
async def add_slide(
    _auth: dict = Depends(require_auth),
    image: UploadFile = File(None),
    notes: str = Form(""),
    position: int = Form(-1),
    slide_type: str = Form("image"),
    title: str = Form(""),
    subtitle: str = Form(""),
    label: str = Form(""),
) -> dict:
    slides = _load()

    new_entry: dict[str, Any] = {
        "id": 0,
        "type": slide_type,
        "notes": notes,
    }

    if slide_type == "divider":
        new_entry["label"] = label
        new_entry["title"] = title
        new_entry["subtitle"] = subtitle
    elif image:
        # Save image to scenes/
        timestamp = int(time.time())
        ext = "jpg"
        filename = f"slide_new_{timestamp}.{ext}"
        SCENES_DIR.mkdir(parents=True, exist_ok=True)
        image_bytes = await image.read()
        (SCENES_DIR / filename).write_bytes(image_bytes)
        new_entry["image"] = f"/storyboard/scenes/{filename}"

        # Optionally commit image to GitHub
        pat = _github_pat()
        if pat:
            _commit_to_github(
                f"gui/public/storyboard/scenes/{filename}",
                image_bytes,
                f"add slide image {filename}",
            )

    # Insert at position
    if position < 0 or position >= len(slides):
        slides.append(new_entry)
    else:
        slides.insert(position, new_entry)

    # Re-number
    for i, s in enumerate(slides):
        s["id"] = i + 1

    _save(slides)
    commit = _commit_slides("add new slide to storyboard")
    return {"ok": True, "slide": new_entry, "total": len(slides), "github": commit}
