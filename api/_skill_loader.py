"""Dynamically load the four skill modules.

The skill folders use hyphen separated names (e.g. `audience-segment-builder`)
which are not importable as standard Python packages. Each module is loaded
once at import time using `importlib.util` and cached for re-use across
requests. This mirrors the loader pattern used by the test files.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = REPO_ROOT / "skills"
DB_PATH = REPO_ROOT / "data" / "macys.db"
IMAGES_DIR = REPO_ROOT / "data" / "images" / "dam"


def _load(folder: str, file: str, mod_name: str) -> ModuleType:
    path = SKILLS_DIR / folder / file
    if not path.exists():
        raise FileNotFoundError(f"skill file not found: {path}")
    spec = importlib.util.spec_from_file_location(mod_name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


SEGMENT = _load("audience-segment-builder", "segment.py", "asb_segment")
DAM = _load("dam-asset-finder", "search.py", "daf_search")
LOCALIZE = _load("localization-generator", "generate.py", "lg_generate")
ANALYZE = _load("campaign-performance-analyzer", "analyze.py", "cpa_analyze")
