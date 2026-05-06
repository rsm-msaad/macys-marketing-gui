"""FastAPI app for Macy's marketing operations GUI.

Run from the repo root:
    uv run uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api._skill_loader import DB_PATH, IMAGES_DIR
from api.routes import chat, personas, skills, workflow

app = FastAPI(
    title="Macy's Marketing Operations API",
    description=(
        "Local backend for the M2 GUI. Wraps the four skills in HTTP endpoints "
        "and serves persona, workflow, and scripted chat data."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "db_exists": Path(DB_PATH).exists(),
        "images_dir_exists": Path(IMAGES_DIR).exists(),
    }


app.include_router(personas.router)
app.include_router(workflow.router)
app.include_router(skills.router)
app.include_router(chat.router)

# Static images (DAM thumbnails). Files live in data/images/dam/ but may not
# exist if download_images.py has not been run. Mount path is `/images`.
if Path(IMAGES_DIR).exists():
    app.mount(
        "/images/dam",
        StaticFiles(directory=str(IMAGES_DIR)),
        name="dam_images",
    )
