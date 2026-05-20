"""Lazy loader for the four automation modules.

The skill folders use hyphen-separated names (e.g. `audience-segment-builder`)
which are not importable as standard Python packages. Each module is loaded
on first access using `importlib.util`, not at import time. This avoids
pulling numpy + sklearn (~100 MB) into memory at startup on Render.

Usage is unchanged:
    from api._skill_loader import SEGMENT
    SEGMENT.build_segments(brief)

SEGMENT, DAM, LOCALIZE, and ANALYZE are module-level objects that defer
the actual import until the first attribute access.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
AUTOMATIONS_DIR = REPO_ROOT / "ai_engine" / "automations"
DB_PATH = REPO_ROOT / "data" / "macys.db"
IMAGES_DIR = REPO_ROOT / "data" / "images" / "dam"


def _load(folder: str, file: str, mod_name: str) -> ModuleType:
    path = AUTOMATIONS_DIR / folder / file
    if not path.exists():
        raise FileNotFoundError(f"automation file not found: {path}")
    spec = importlib.util.spec_from_file_location(mod_name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class _LazyModule:
    """Proxy that defers module loading until first attribute access."""

    def __init__(self, folder: str, file: str, mod_name: str) -> None:
        object.__setattr__(self, "_folder", folder)
        object.__setattr__(self, "_file", file)
        object.__setattr__(self, "_mod_name", mod_name)
        object.__setattr__(self, "_module", None)

    def _ensure_loaded(self) -> ModuleType:
        mod = object.__getattribute__(self, "_module")
        if mod is None:
            folder = object.__getattribute__(self, "_folder")
            file = object.__getattribute__(self, "_file")
            mod_name = object.__getattribute__(self, "_mod_name")
            mod = _load(folder, file, mod_name)
            object.__setattr__(self, "_module", mod)
        return mod

    def __getattr__(self, name: str) -> Any:
        mod = self._ensure_loaded()
        return getattr(mod, name)


SEGMENT = _LazyModule("audience-segment-builder", "segment.py", "asb_segment")
DAM = _LazyModule("dam-asset-finder", "search.py", "daf_search")
LOCALIZE = _LazyModule("localization-generator-v1", "generate.py", "lg_generate")
ANALYZE = _LazyModule("campaign-performance-analyzer", "analyze.py", "cpa_analyze")
SKU_RECOMMEND = _LazyModule("sku-recommender", "recommend.py", "sku_recommend")
