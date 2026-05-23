"""Knowledge Base endpoint — lists the 12 RAG documents with metadata."""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["knowledge"])

_KB_DIR = Path(__file__).resolve().parents[2] / "ai_engine" / "rag" / "knowledge_base"

# Static metadata: doc ID → category, description, used-by skills
_DOC_META: dict[str, dict] = {
    "BRAND-GL-2026-001": {
        "category": "Guidelines",
        "description": "Banned words, approved taglines, and brand voice rules for campaign copy.",
        "used_by": ["Compliance Pre Check"],
    },
    "APPROVAL-POLICY-2026-001": {
        "category": "Policy",
        "description": "Campaign approval workflow, authorization levels, and escalation rules.",
        "used_by": ["Approval Brief Generator"],
    },
    "APPRV-POL-2025-003": {
        "category": "Policy",
        "description": "Campaign approval workflow, authorization levels, and escalation rules.",
        "used_by": ["Approval Brief Generator"],
    },
    "LEGAL-DIS-2026-002": {
        "category": "Reference",
        "description": "Required disclaimers for percent-off pricing and Star Rewards multipliers.",
        "used_by": ["Compliance Pre Check"],
    },
    "PRICE-RULES-2026-001": {
        "category": "Reference",
        "description": "MAP minimums, brand discount exclusions, and stacking ceiling rules.",
        "used_by": ["Compliance Pre Check"],
    },
    "DAM-POLICY-2026-001": {
        "category": "Policy",
        "description": "Digital asset tagging standards, rights management, and usage policies.",
        "used_by": ["DAM Asset Finder"],
    },
    "DAM-TAG-2025-005": {
        "category": "Policy",
        "description": "Digital asset tagging standards, rights management, and usage policies.",
        "used_by": ["DAM Asset Finder"],
    },
    "LOC-STYLE-2025-002": {
        "category": "Guidelines",
        "description": "Spanish and Quebec French localization rules, holiday calendar, regional norms.",
        "used_by": ["Localization Generator"],
    },
    "RETRO-Q4-2025": {
        "category": "Retro",
        "description": "Q4 2025 Holiday campaign retrospective with ROAS benchmarks and channel attribution.",
        "used_by": ["Approval Brief Generator"],
    },
    "RETRO-SP-2025-BTY": {
        "category": "Retro",
        "description": "Spring 2025 Beauty campaign retro with Beauty Loyalists metrics and lift data.",
        "used_by": ["Approval Brief Generator"],
    },
    "TICKET-INC-2025-4471": {
        "category": "Ticket",
        "description": "Past revision ticket: pricing language fix and MAP brand clearance example.",
        "used_by": ["Revision Router"],
    },
    "TICKET-INC-2026-0212": {
        "category": "Ticket",
        "description": "Clean approval cycle reference for benchmarking normal flow times.",
        "used_by": ["Revision Router"],
    },
    "COMP-EX-2026-001": {
        "category": "Reference",
        "description": "Compliance flag examples by category (Beauty, Home, Apparel).",
        "used_by": ["Compliance Pre Check"],
    },
    "TEAM-FAQ-2026-001": {
        "category": "Reference",
        "description": "Internal team FAQ covering common questions and runbook references.",
        "used_by": ["Cross-cutting"],
    },
    "FAQ-INT-2026-001": {
        "category": "Reference",
        "description": "Internal team FAQ covering common questions and runbook references.",
        "used_by": ["Cross-cutting"],
    },
}


def _extract_metadata(content: str) -> dict:
    """Extract doc_id, title, owner, updated from markdown header."""
    title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    doc_id_match = re.search(r"\*\*Document ID:\*\*\s*(.+)$", content, re.MULTILINE)
    owner_match = re.search(r"\*\*Owner:\*\*\s*(.+)$", content, re.MULTILINE)
    updated_match = re.search(r"\*\*Last updated:\*\*\s*(.+)$", content, re.MULTILINE)
    return {
        "title": title_match.group(1).strip() if title_match else "Untitled",
        "doc_id": doc_id_match.group(1).strip() if doc_id_match else "",
        "owner": owner_match.group(1).strip() if owner_match else "",
        "updated": updated_match.group(1).strip() if updated_match else "",
    }


@router.get("/knowledge")
def list_knowledge_docs() -> dict:
    """Return all 12 RAG documents with metadata."""
    docs = []
    for path in sorted(_KB_DIR.glob("*.md")):
        if path.name in ("README.md", "EXAMPLE.md"):
            continue
        content = path.read_text(encoding="utf-8")
        meta = _extract_metadata(content)
        doc_id = meta["doc_id"]
        static = _DOC_META.get(doc_id, {})
        docs.append({
            "doc_id": doc_id,
            "title": meta["title"],
            "owner": meta["owner"],
            "updated": meta["updated"],
            "category": static.get("category", "Reference"),
            "description": static.get("description", ""),
            "used_by": static.get("used_by", []),
            "filename": path.name,
            "word_count": len(content.split()),
        })
    return {"docs": docs, "total": len(docs)}


@router.get("/knowledge/{doc_id}")
def get_knowledge_doc(doc_id: str) -> dict:
    """Return a single document's full content."""
    for path in _KB_DIR.glob("*.md"):
        content = path.read_text(encoding="utf-8")
        meta = _extract_metadata(content)
        if meta["doc_id"] == doc_id:
            static = _DOC_META.get(doc_id, {})
            return {
                "doc_id": doc_id,
                "title": meta["title"],
                "owner": meta["owner"],
                "updated": meta["updated"],
                "category": static.get("category", "Reference"),
                "description": static.get("description", ""),
                "used_by": static.get("used_by", []),
                "filename": path.name,
                "content": content,
            }
    raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
