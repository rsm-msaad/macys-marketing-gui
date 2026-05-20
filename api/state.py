"""In-memory campaign state for the demo, with disk persistence.

Single process state backed by a JSON file so it survives Render free tier
restarts (the process sleeps after 15 minutes of inactivity). On every
mutation the full state is written to STATE_FILE. On startup the file is
read back and merged over the seeded defaults.

For production we would back this with sqlite or postgres.
"""

from __future__ import annotations

import json
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Use a path relative to the project directory so it survives Render
# redeploys. /tmp is wiped on every deploy on Render free tier.
STATE_FILE = Path(__file__).resolve().parent.parent / ".runtime_state.json"

DEMO_CAMPAIGN_ID = "MDC-2026-MD-001"
LAST_STEP = 10

STEP_NAMES: dict[int, str] = {
    1: "Briefing",
    2: "Segmentation",
    3: "SKU Selection",
    4: "Creative Production",
    5: "Layout Assembly",
    6: "Approval",
    7: "Localization",
    8: "Activation",
    9: "Monitoring",
    10: "Reporting",
}

_LOCK = threading.Lock()


def _fresh_state() -> dict[str, Any]:
    """True fresh start at step 1 (used by the Reset Demo button)."""
    return {
        "current_step": 1,
        "completed_steps": [],
        "step_outputs": {},
        "history": [],
        "revisions": {},
        "pending_revision": None,
    }


def _initial_state() -> dict[str, Any]:
    """Demo campaign seeds at Step 6 with Steps 1-5 pre-completed so the
    Step 6 AI cascade is immediately reachable after every deploy."""
    return {
        "current_step": 6,
        "completed_steps": [1, 2, 3, 4, 5],
        "step_outputs": {
            "1": {"summary": "Brief approved by Marketing Leadership."},
            "2": {"name": "VIP Loyalists", "customer_count": 9590},
            "3": {"approved_skus": ["MAC-001", "EL-001", "CLQ-001"]},
            "4": {"approved_asset_count": 12},
            "5": {"approved_layouts": ["web_banner", "email", "mobile", "in_store_signage"]},
        },
        "history": [
            {
                "step": i,
                "step_name": STEP_NAMES.get(i, ""),
                "action": "Approved",
                "ts": "2026-05-18T10:00:00Z",
                "metadata": {},
            }
            for i in range(1, 6)
        ],
        # Revision tracking: per-step list of past revision requests.
        "revisions": {},
        # When a revision is in flight, holds the metadata; None otherwise.
        "pending_revision": None,
    }


SPRING_CAMPAIGN_ID = "MDC-2025-SP-BTY"
SUMMER_CAMPAIGN_ID = "MDC-2026-SS-003"


def _completed_spring_state() -> dict[str, Any]:
    """Pre-built state for Spring Beauty Refresh -- fully completed, March 2025."""
    return {
        "current_step": 11,  # past last step = complete
        "completed_steps": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "step_outputs": {
            "1": {
                "summary": "Brief filed by VP of Marketing for Spring Beauty Refresh targeting Women 25-45, Macy's Star Rewards members. Budget: $250K. Launch window: March 1-21, 2025."
            },
            "2": {
                "summary": "3 audience segments built: Spring Skincare Enthusiasts (42K), Returning Fragrance Buyers (28K), New-to-Beauty Loyalists (19K). Total reach: 89K qualified customers."
            },
            "3": {
                "summary": "14 SKUs selected across Skincare, Lip, and Eye subcategories. Avg margin 51%, avg segment match 0.84."
            },
            "4": {
                "summary": "6 DAM assets retrieved and approved for campaign creative.",
                "dam_assets": [
                    {
                        "rank": 1,
                        "asset_id": 8801,
                        "filename": "spring_hero_pastel_gradient.jpg",
                        "asset_type": "photography",
                        "tags": ["spring", "beauty", "pastel", "hero"],
                        "resolution": "4000x2667",
                        "usage_rights": "perpetual",
                        "relevance_score": 0.96,
                        "quality_flag": "approved",
                    },
                    {
                        "rank": 2,
                        "asset_id": 8802,
                        "filename": "clinique_moisture_surge_flat_lay.jpg",
                        "asset_type": "product_shot",
                        "tags": ["clinique", "skincare", "flat_lay", "spring"],
                        "resolution": "3000x3000",
                        "usage_rights": "perpetual",
                        "relevance_score": 0.93,
                        "quality_flag": "approved",
                    },
                    {
                        "rank": 3,
                        "asset_id": 8803,
                        "filename": "mac_lipstick_trio_editorial.jpg",
                        "asset_type": "editorial",
                        "tags": ["MAC", "lip", "editorial", "color"],
                        "resolution": "3500x2333",
                        "usage_rights": "expires_2026_Q2",
                        "relevance_score": 0.91,
                        "quality_flag": "approved",
                    },
                    {
                        "rank": 4,
                        "asset_id": 8804,
                        "filename": "estee_lauder_anr_lifestyle.jpg",
                        "asset_type": "lifestyle",
                        "tags": ["estee_lauder", "serum", "lifestyle", "woman"],
                        "resolution": "4000x2667",
                        "usage_rights": "perpetual",
                        "relevance_score": 0.88,
                        "quality_flag": "approved",
                    },
                    {
                        "rank": 5,
                        "asset_id": 8805,
                        "filename": "nars_blush_swatch_closeup.jpg",
                        "asset_type": "product_detail",
                        "tags": ["NARS", "blush", "swatch", "cheek"],
                        "resolution": "2500x2500",
                        "usage_rights": "perpetual",
                        "relevance_score": 0.85,
                        "quality_flag": "approved",
                    },
                    {
                        "rank": 6,
                        "asset_id": 8806,
                        "filename": "spring_bouquet_brand_texture.jpg",
                        "asset_type": "texture",
                        "tags": ["spring", "floral", "texture", "background"],
                        "resolution": "5000x3333",
                        "usage_rights": "perpetual",
                        "relevance_score": 0.82,
                        "quality_flag": "approved",
                    },
                ],
            },
            "5": {
                "summary": "4 layouts assembled: web banner (1200x628), email (600x800), mobile (414x896), in-store signage (1080x1920). All assets QA-passed."
            },
            "6": {
                "compliance": {
                    "status": "pass",
                    "checks": [
                        {
                            "rule": "Brand voice alignment",
                            "result": "pass",
                            "note": "Copy on-voice per Spring 2025 brand guide (Section 4.2)",
                        },
                        {
                            "rule": "Discount T&C disclosure",
                            "result": "pass",
                            "note": "Footnote includes exclusion list and Star Rewards terms per Legal memo LM-2025-019",
                        },
                        {
                            "rule": "Image licensing",
                            "result": "pass",
                            "note": "All 6 DAM assets have valid rights through at least Q2 2026",
                        },
                        {
                            "rule": "Accessibility (WCAG 2.1 AA)",
                            "result": "pass",
                            "note": "Color contrast 4.8:1 on all placements; alt text present on every image",
                        },
                    ],
                },
                "approval_brief": {
                    "title": "Spring Beauty Refresh -- Final Approval Brief",
                    "submitted_to": "VP of Marketing",
                    "recommendation": "Approve for activation",
                    "budget_summary": "$250K total ($150K paid media, $60K store experience, $40K email/CRM)",
                    "projected_revenue": "$680K (2.7x ROAS)",
                    "risk_flags": "None. All compliance checks passed. Inventory levels sufficient across all 14 SKUs.",
                    "key_highlights": [
                        "Spring Skincare Enthusiasts segment projected to drive 48% of revenue",
                        "Free-gift-with-purchase threshold set at $65 to maximize basket size",
                        "Regional pricing validated across all 6 test markets",
                    ],
                },
                "routing": {
                    "decision": "Approved",
                    "revisions_needed": False,
                    "note": "VP approved on first review. No revisions required.",
                },
            },
            "7": {
                "summary": "Localized to 4 regions with Spanish and Quebec French translations.",
                "variants": [
                    {
                        "region": "US-Southeast",
                        "language": "English",
                        "headline": "Spring Blooms, Fresh Looks",
                        "subhead": "20% off Skincare + free gift on $65+.",
                    },
                    {
                        "region": "US-Southwest",
                        "language": "Spanish",
                        "headline": "Primavera en flor, belleza renovada",
                        "subhead": "20% de descuento en Cuidado de la Piel + regalo gratis en compras de $65+.",
                    },
                    {
                        "region": "CA-Quebec",
                        "language": "French (Quebec)",
                        "headline": "Le printemps s'epanouit, la beaute aussi",
                        "subhead": "20 % de rabais sur les soins de la peau + cadeau gratuit a l'achat de 65 $ et plus.",
                    },
                    {
                        "region": "US-Northeast",
                        "language": "English",
                        "headline": "Refresh Your Routine This Spring",
                        "subhead": "Star Rewards members: 20% off + free shipping over $50.",
                    },
                ],
            },
            "8": {
                "summary": "All 5 channels activated on schedule.",
                "schedule": [
                    {
                        "channel": "Email",
                        "time": "Monday 7:00 AM ET",
                        "audience": "2.1M Star Rewards members",
                        "status": "Sent",
                    },
                    {
                        "channel": "Web",
                        "time": "Monday 12:00 AM ET",
                        "audience": "macys.com homepage + Beauty category",
                        "status": "Live",
                    },
                    {
                        "channel": "Mobile",
                        "time": "Monday 12:00 AM ET",
                        "audience": "Macy's app Beauty tab + push",
                        "status": "Live",
                    },
                    {
                        "channel": "In-Store",
                        "time": "Tuesday rollout",
                        "audience": "432 stores nationwide",
                        "status": "Deployed",
                    },
                    {
                        "channel": "Paid Social",
                        "time": "Monday 9:00 AM ET",
                        "audience": "Meta + TikTok lookalikes",
                        "status": "Running",
                    },
                ],
            },
            "9": {
                "summary": "Campaign ran for 21 days. Final performance below.",
                "totals": {
                    "revenue": "$682K",
                    "spend": "$250K",
                    "roas": "2.7x",
                    "conversions": 4820,
                    "new_customers": 1340,
                    "email_open_rate": "24.1%",
                },
                "top_channel": "Email (drove 38% of revenue)",
                "top_segment": "Spring Skincare Enthusiasts (drove 46% of conversions)",
                "learnings": [
                    "Free-gift threshold at $65 lifted AOV by 12% vs. control",
                    "Quebec French localization drove 2.3x higher CTR than generic English in CA-Quebec",
                    "In-store signage underperformed digital channels; consider reducing budget next cycle",
                    "Paid social ROAS (2.1x) trailed email (4.6x); reallocate 15% of social budget to email for summer",
                ],
            },
            "10": {"summary": "Final report delivered to VP of Marketing. Campaign archived."},
        },
        "history": [
            {
                "step": i,
                "step_name": STEP_NAMES.get(i, ""),
                "action": "Approved",
                "ts": f"2025-03-{i:02d}T10:00:00Z",
                "metadata": {},
            }
            for i in range(1, 11)
        ],
        "revisions": {},
        "pending_revision": None,
    }


def _planned_summer_state() -> dict[str, Any]:
    """Pre-built state for Summer Style -- steps 1-2 complete, step 3 active."""
    return {
        "current_step": 3,
        "completed_steps": [1, 2],
        "step_outputs": {
            "1": {
                "summary": "Brief filed for Summer Style targeting Women and Men 22-40 with resort/vacation purchase history. Budget: $400K. Planned launch: July 1, 2026."
            },
            "2": {
                "summary": "2 audience segments built: Summer Resort Shoppers (48K) and Vacation-Ready Loyalists (31K). Total reach: 79K qualified customers."
            },
        },
        "history": [
            {"step": 1, "step_name": "Briefing", "action": "Approved", "ts": "2026-05-10T09:00:00Z", "metadata": {}},
            {
                "step": 2,
                "step_name": "Segmentation",
                "action": "Approved",
                "ts": "2026-05-14T14:00:00Z",
                "metadata": {},
            },
        ],
        "revisions": {},
        "pending_revision": None,
    }


_STATE: dict[str, dict[str, Any]] = {
    DEMO_CAMPAIGN_ID: _initial_state(),
    SPRING_CAMPAIGN_ID: _completed_spring_state(),
    SUMMER_CAMPAIGN_ID: _planned_summer_state(),
}


# ---- disk persistence ----


def _persist() -> None:
    """Write _STATE and _BRIEFS to disk. Called after every mutation."""
    try:
        payload = json.dumps(
            {"state": _STATE, "briefs": _BRIEFS},
            default=str,
            ensure_ascii=False,
        )
        STATE_FILE.write_text(payload, encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"[state] persist failed: {exc}", file=sys.stderr, flush=True)


def _restore() -> None:
    """Load persisted state from disk, merging over seeded defaults."""
    if not STATE_FILE.exists():
        return
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        saved_state = raw.get("state", {})
        saved_briefs = raw.get("briefs", {})
        # Merge: persisted data wins over seeded defaults.
        _STATE.update(saved_state)
        _BRIEFS.update(saved_briefs)
        print(
            f"[state] restored {len(saved_state)} campaigns, {len(saved_briefs)} briefs from {STATE_FILE}",
            file=sys.stderr,
            flush=True,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[state] restore failed, using defaults: {exc}", file=sys.stderr, flush=True)


def _snapshot(s: dict[str, Any]) -> dict[str, Any]:
    return {
        "current_step": s["current_step"],
        "completed_steps": list(s["completed_steps"]),
        "step_outputs": dict(s["step_outputs"]),
        "history": list(s["history"]),
        "is_complete": s["current_step"] > LAST_STEP,
        "revisions": {k: list(v) for k, v in s.get("revisions", {}).items()},
        "pending_revision": dict(s["pending_revision"]) if s.get("pending_revision") else None,
    }


def get_state(campaign_id: str) -> dict[str, Any] | None:
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            return None
        return _snapshot(s)


def advance(
    campaign_id: str,
    step: int,
    action: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Mark `step` complete and move to step+1.

    Raises:
        KeyError if the campaign id is unknown.
        ValueError if the step does not match current_step or has already
        been completed.
    """
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            raise KeyError(f"unknown campaign: {campaign_id}")
        if s["current_step"] > LAST_STEP:
            raise ValueError("campaign is already complete; reset to replay")
        if s.get("pending_revision"):
            raise ValueError("campaign has a pending revision; resubmit before advancing")
        if step != s["current_step"]:
            raise ValueError(f"campaign is at step {s['current_step']}, cannot advance step {step}")
        if step in s["completed_steps"]:
            raise ValueError(f"step {step} is already completed")
        s["completed_steps"].append(step)
        s["current_step"] = step + 1
        entry = {
            "step": step,
            "step_name": STEP_NAMES.get(step, f"Step {step}"),
            "action": action,
            "ts": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata or {},
        }
        s["history"].append(entry)
        if metadata:
            s["step_outputs"][str(step)] = metadata
        result = _snapshot(s)
        _persist()
        return result


def reset(campaign_id: str) -> dict[str, Any]:
    with _LOCK:
        if campaign_id not in _STATE:
            raise KeyError(f"unknown campaign: {campaign_id}")
        _STATE[campaign_id] = _fresh_state()
        result = _snapshot(_STATE[campaign_id])
        _persist()
        return result


def request_revisions(
    campaign_id: str,
    from_step: int,
    send_back_to_step: int,
    comment: str,
    requested_by_persona_id: str,
) -> dict[str, Any]:
    """Send the campaign back to `send_back_to_step` with a comment.

    `from_step` is where the requester is currently working (typically
    `current_step`). When `from_step == send_back_to_step` (e.g., the step 1
    Briefing case where there is no prior step, or the step 10 Hold for Edits
    case), no state change happens beyond recording the revision and setting
    `pending_revision`. Otherwise:

    * Remove `send_back_to_step` from `completed_steps` so it can be redone.
    * Set `current_step` back to `send_back_to_step`.
    * Set `pending_revision` so the GUI can render the resubmit panel.

    Raises:
        KeyError if the campaign id is unknown.
        ValueError on invalid step parameters or while another revision is
        already pending.
    """
    if not isinstance(comment, str) or len(comment.strip()) < 10:
        raise ValueError("revision comment must be at least 10 characters")
    if send_back_to_step < 1 or send_back_to_step > LAST_STEP:
        raise ValueError(f"send_back_to_step must be between 1 and {LAST_STEP}")
    if send_back_to_step > from_step:
        raise ValueError("can only send revisions back to the same or earlier step")

    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            raise KeyError(f"unknown campaign: {campaign_id}")
        if s["current_step"] > LAST_STEP:
            raise ValueError("campaign is already complete; reset to replay")
        if s.get("pending_revision"):
            raise ValueError("campaign already has a pending revision")
        if from_step != s["current_step"]:
            raise ValueError(f"campaign is at step {s['current_step']}, cannot request revisions from step {from_step}")

        ts = datetime.now(timezone.utc).isoformat()
        entry = {
            "comment": comment.strip(),
            "requested_by_persona_id": requested_by_persona_id,
            "requested_from_step": from_step,
            "ts": ts,
        }
        revisions = s.setdefault("revisions", {})
        revisions.setdefault(str(send_back_to_step), []).append(entry)

        # Always set pending_revision so the UI knows there is work to resubmit.
        s["pending_revision"] = {
            "step_to_redo": send_back_to_step,
            "resume_step": from_step,
            "comment": comment.strip(),
            "requested_by_persona_id": requested_by_persona_id,
            "requested_at": ts,
            "requested_from_step": from_step,
        }

        # If the target is a different step, rewind: remove from completed,
        # move current_step back. If from_step == send_back_to_step (step 1
        # or step 10 Hold for Edits) the state otherwise stays put.
        if from_step != send_back_to_step:
            if send_back_to_step in s["completed_steps"]:
                s["completed_steps"].remove(send_back_to_step)
            s["current_step"] = send_back_to_step

        s["history"].append(
            {
                "step": from_step,
                "step_name": STEP_NAMES.get(from_step, f"Step {from_step}"),
                "action": (
                    "Hold for Edits"
                    if from_step == send_back_to_step
                    else f"Request Revisions (back to step {send_back_to_step})"
                ),
                "ts": ts,
                "metadata": {
                    "send_back_to_step": send_back_to_step,
                    "comment": comment.strip(),
                },
            }
        )
        result = _snapshot(s)
        _persist()
        return result


def resubmit(campaign_id: str, step: int) -> dict[str, Any]:
    """Mark the step that was sent back as resubmitted.

    Adds the step to `completed_steps` (if it isn't the resume step itself),
    advances `current_step` back to the original requester's step, and clears
    `pending_revision`.
    """
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            raise KeyError(f"unknown campaign: {campaign_id}")
        pending = s.get("pending_revision")
        if pending is None:
            raise ValueError("no pending revision to resubmit")
        if step != pending["step_to_redo"]:
            raise ValueError(f"resubmit step {step} does not match pending step {pending['step_to_redo']}")

        resume_step = pending["resume_step"]
        ts = datetime.now(timezone.utc).isoformat()

        if step != resume_step and step not in s["completed_steps"]:
            s["completed_steps"].append(step)
            s["completed_steps"].sort()
        s["current_step"] = resume_step
        s["pending_revision"] = None

        s["history"].append(
            {
                "step": step,
                "step_name": STEP_NAMES.get(step, f"Step {step}"),
                "action": f"Resubmit ({STEP_NAMES.get(step, '')})",
                "ts": ts,
                "metadata": {"resume_step": resume_step},
            }
        )
        result = _snapshot(s)
        _persist()
        return result


def status_for_step(campaign_id: str, step_number: int) -> str:
    """Map a step number to its current status under live state.

    Returns one of: complete, active, pending. (We collapse "blocked" into
    "pending" since the workflow is strictly sequential; the frontend may
    still render a lock icon for steps far ahead of current_step.)
    """
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            return "pending"
        if step_number in s["completed_steps"]:
            return "complete"
        if step_number == s["current_step"]:
            return "active"
        return "pending"


def current_step_for(campaign_id: str) -> int | None:
    with _LOCK:
        s = _STATE.get(campaign_id)
        if s is None:
            return None
        return s["current_step"]


# ---------- campaign CRUD ----------

_NEXT_SEQ = 4  # MDC-2026-xx-001 through 003 are seeds


def _gen_id() -> str:
    global _NEXT_SEQ
    seq = _NEXT_SEQ
    _NEXT_SEQ += 1
    return f"MDC-2026-UC-{seq:03d}"


# In memory store of campaign briefs keyed by campaign_id.
_BRIEFS: dict[str, dict[str, Any]] = {}


def get_brief(campaign_id: str) -> dict[str, Any] | None:
    """Return the campaign brief for a given id, or None."""
    with _LOCK:
        return _BRIEFS.get(campaign_id)


def upsert_brief(brief: dict[str, Any]) -> dict[str, Any]:
    """Create or update a campaign brief. Returns the saved brief."""
    with _LOCK:
        cid = brief.get("campaign_id") or _gen_id()
        brief["campaign_id"] = cid
        _BRIEFS[cid] = brief
        # Ensure workflow state exists
        if cid not in _STATE:
            _STATE[cid] = _fresh_state()
        _persist()
        return dict(brief)


def list_briefs() -> list[dict[str, Any]]:
    """Return all stored campaign briefs."""
    with _LOCK:
        return list(_BRIEFS.values())


# ---------- demo content (brief + mock per step data) ----------
#
# These constants feed the GUI's step content components so reviewers see the
# full carry forward narrative (brief -> segment -> SKUs -> assets -> ...)
# instead of bare "Approve X" buttons. None of this touches the four skills;
# the skills always run against the real database.

CAMPAIGN_BRIEF: dict[str, Any] = {
    "campaign_id": DEMO_CAMPAIGN_ID,
    "name": "Mother's Day Beauty Event",
    "sponsor": "VP of Marketing",
    "filed_days_before_launch": 12,
    "objective": (
        "Drive Beauty category revenue +20% vs last year's Mother's Day "
        "window. Win back lapsed Beauty buyers and acquire first-time Beauty "
        "customers from existing Macy's loyalists."
    ),
    "target_customer": (
        "Women 28 to 55, Macy's Star Rewards members, with prior Beauty "
        "purchases or expressed Beauty preference. Emphasis on Gold and "
        "Platinum tier loyalty members."
    ),
    "promotional_offer": [
        "25% off all Beauty (excluding fragrance and prestige skincare)",
        "Free gift with purchase $75+",
        "Free shipping on Beauty orders over $50",
    ],
    "campaign_window": {
        "soft_launch": "14 days before Mother's Day",
        "peak": "7 days before Mother's Day",
        "closeout": "Mother's Day end of day",
    },
    "budget": {
        "paid_media": "$1.2M",
        "store_experience": "$400K",
        "email_crm": "$200K",
        "total": "$1.8M",
    },
    "success_metrics": {
        "revenue_target": "$4.2M",
        "roas_goal": "3.5x",
        "new_beauty_customer_acquisition": "5,000+",
        "email_open_rate": "22%+",
    },
    "constraints": [
        "Legal review required for all final creative",
        "Cannot include prestige skincare brands (Tom Ford, La Mer, etc.)",
        "Regional pricing must reflect inventory levels",
        "Must include Star Rewards member-exclusive offer",
    ],
}

# Seed the default brief into the briefs store.
_BRIEFS[DEMO_CAMPAIGN_ID] = CAMPAIGN_BRIEF

SPRING_BRIEF: dict[str, Any] = {
    "campaign_id": SPRING_CAMPAIGN_ID,
    "name": "Spring Beauty Refresh",
    "sponsor": "VP of Marketing",
    "filed_days_before_launch": 30,
    "objective": (
        "Drive Skincare and Lip category revenue +15% vs prior spring window. "
        "Re-engage lapsed Beauty buyers from holiday 2024 and convert "
        "Spring-browsing loyalists into purchasers."
    ),
    "target_customer": (
        "Women 25 to 45, Macy's Star Rewards members, with prior Beauty or "
        "Skincare purchases. Emphasis on Silver and Gold tier loyalty members."
    ),
    "promotional_offer": [
        "20% off Skincare and Lip (excluding prestige brands)",
        "Free gift with purchase $65+",
        "Free shipping on Beauty orders over $50",
    ],
    "campaign_window": {
        "soft_launch": "March 1, 2025",
        "peak": "March 8-15, 2025",
        "closeout": "March 21, 2025",
    },
    "budget": {
        "paid_media": "$150K",
        "store_experience": "$60K",
        "email_crm": "$40K",
        "total": "$250K",
    },
    "success_metrics": {
        "revenue_target": "$680K",
        "roas_goal": "2.7x",
        "new_beauty_customer_acquisition": "1,300+",
        "email_open_rate": "23%+",
    },
    "constraints": [
        "Legal review required for all final creative",
        "Cannot include prestige skincare brands (Tom Ford, La Mer, etc.)",
        "Regional pricing must reflect inventory levels",
        "Must include Star Rewards member-exclusive offer",
    ],
}
_BRIEFS[SPRING_CAMPAIGN_ID] = SPRING_BRIEF

SUMMER_BRIEF: dict[str, Any] = {
    "campaign_id": SUMMER_CAMPAIGN_ID,
    "name": "Summer Style",
    "sponsor": "VP of Marketing",
    "filed_days_before_launch": 44,
    "objective": (
        "Drive summer apparel and swim category revenue +22% vs last July. "
        "Capture vacation-planning shoppers and convert spring browsers "
        "into summer wardrobe buyers."
    ),
    "target_customer": (
        "Women and Men 22 to 40, Macy's Star Rewards members, with prior "
        "Apparel or Swim purchases or resort/vacation browsing history. "
        "Emphasis on Gold tier loyalty members."
    ),
    "promotional_offer": [
        "25% off Swim and Resort Wear",
        "Buy 2 get 1 free on summer dresses",
        "Free shipping on orders over $75",
    ],
    "campaign_window": {
        "soft_launch": "July 1, 2026",
        "peak": "July 4-12, 2026",
        "closeout": "July 20, 2026",
    },
    "budget": {
        "paid_media": "$240K",
        "store_experience": "$100K",
        "email_crm": "$60K",
        "total": "$400K",
    },
    "success_metrics": {
        "revenue_target": "$1.1M",
        "roas_goal": "2.8x",
        "new_summer_customer_acquisition": "2,500+",
        "email_open_rate": "21%+",
    },
    "constraints": [
        "Legal review required for all final creative",
        "Swim imagery must comply with brand modesty guidelines",
        "Regional pricing must reflect warehouse inventory",
        "Must include Star Rewards member-exclusive offer",
    ],
}
_BRIEFS[SUMMER_CAMPAIGN_ID] = SUMMER_BRIEF


def _sku(
    sku_id: int,
    name: str,
    brand: str,
    subcategory: str,
    base_price: float,
    inventory_status: str,
    inventory_units: int,
    margin_pct: float,
    segment_match_score: float,
    reason: str,
) -> dict[str, Any]:
    return {
        "sku_id": sku_id,
        "name": name,
        "brand": brand,
        "category": "Beauty",
        "subcategory": subcategory,
        "base_price": base_price,
        "inventory_status": inventory_status,
        "inventory_units": inventory_units,
        "margin_pct": margin_pct,
        "segment_match_score": segment_match_score,
        "reason": reason,
    }


# Step 3: 18 Beauty SKU suggestions, mid-tier through prestige but excluding
# the brands the brief restricts (Tom Ford, La Mer, etc.).
MOCK_SKU_SUGGESTIONS: list[dict[str, Any]] = [
    _sku(
        2401,
        "Ruby Woo Lipstick",
        "MAC",
        "Lip",
        19.00,
        "in_stock",
        1280,
        0.55,
        0.95,
        "Beauty hero; iconic Mother's Day pick across tiers",
    ),
    _sku(
        2402,
        "Advanced Night Repair Serum 50ml",
        "Estee Lauder",
        "Skincare",
        98.00,
        "in_stock",
        870,
        0.48,
        0.91,
        "Top seller for Gold/Platinum loyalists",
    ),
    _sku(
        2403,
        "Moisture Surge 100H Auto-Replenishing Hydrator",
        "Clinique",
        "Skincare",
        42.00,
        "in_stock",
        1140,
        0.50,
        0.88,
        "Strong Silver tier conversion last MD",
    ),
    _sku(
        2404,
        "Genifique Youth Activating Serum",
        "Lancome",
        "Skincare",
        115.00,
        "low_stock",
        38,
        0.45,
        0.87,
        "High AOV; great for gift-with-purchase trigger",
    ),
    _sku(
        2405,
        "Orgasm Blush",
        "NARS",
        "Cheek",
        32.00,
        "in_stock",
        950,
        0.55,
        0.84,
        "Reliable repeat purchase, high margin",
    ),
    _sku(
        2406,
        "Skin Foundation Stick",
        "Bobbi Brown",
        "Face",
        52.00,
        "in_stock",
        720,
        0.45,
        0.82,
        "Pairs well with Beauty bundle gifting",
    ),
    _sku(
        2407,
        "Naked Eyeshadow Palette",
        "Urban Decay",
        "Eye",
        58.00,
        "in_stock",
        610,
        0.50,
        0.80,
        "Drives basket size; Mother's Day giftable",
    ),
    _sku(
        2408,
        "Photo Finish Smooth & Blur Primer",
        "Smashbox",
        "Face",
        42.00,
        "in_stock",
        880,
        0.52,
        0.78,
        "Loyal Silver-tier repeat audience",
    ),
    _sku(
        2409,
        "Pillow Talk Lipstick",
        "Charlotte Tilbury",
        "Lip",
        34.00,
        "in_stock",
        1010,
        0.55,
        0.86,
        "Top giftable lip; strong gift-with-purchase pull",
    ),
    _sku(
        2410,
        "Touche Eclat Highlighter Pen",
        "YSL",
        "Face",
        42.00,
        "in_stock",
        720,
        0.48,
        0.83,
        "Iconic; performs well in MD email",
    ),
    _sku(
        2411,
        "Ultra Facial Cream",
        "Kiehl's",
        "Skincare",
        36.00,
        "in_stock",
        1340,
        0.50,
        0.81,
        "Mid tier; broadens reach",
    ),
    _sku(
        2412,
        "GinZing Refreshing Eye Cream",
        "Origins",
        "Skincare",
        38.00,
        "in_stock",
        1080,
        0.50,
        0.79,
        "Entry-tier MD gift; broadens audience",
    ),
    _sku(
        2413,
        "Studio Fix Powder Plus Foundation",
        "MAC",
        "Face",
        36.00,
        "in_stock",
        950,
        0.55,
        0.82,
        "Long-time MD performer",
    ),
    _sku(
        2414,
        "Double Wear Stay-in-Place Foundation",
        "Estee Lauder",
        "Face",
        48.00,
        "in_stock",
        1100,
        0.50,
        0.84,
        "Top 10 every Mother's Day",
    ),
    _sku(
        2415,
        "Black Honey Almost Lipstick",
        "Clinique",
        "Lip",
        22.00,
        "in_stock",
        1220,
        0.55,
        0.83,
        "Universally flattering; strong gift add",
    ),
    _sku(
        2416,
        "Crushed Liquid Lip Color",
        "Bobbi Brown",
        "Lip",
        32.00,
        "in_stock",
        850,
        0.50,
        0.78,
        "Repeat-purchase favorite",
    ),
    _sku(
        2417,
        "Radiant Creamy Concealer",
        "NARS",
        "Face",
        32.00,
        "in_stock",
        980,
        0.55,
        0.85,
        "High velocity; great margin",
    ),
    _sku(
        2418,
        "Hypnose Volumizing Mascara",
        "Lancome",
        "Eye",
        30.00,
        "in_stock",
        1170,
        0.50,
        0.80,
        "Reliable cross-tier seller",
    ),
]


# Step 5: 4 placement layout previews. Descriptions only — actual creative is
# composed downstream. The headlines here are the demo's sample copy.
MOCK_LAYOUT_PREVIEWS: list[dict[str, Any]] = [
    {
        "placement": "web_banner",
        "dimensions": "1200x628",
        "headline": "Spring Blooms, Bold Lips",
        "subhead": "Mother's Day favorites at 25% off. Free gift on $75+.",
        "cta": "Shop Mother's Day Beauty",
        "notes": "Hero photo: Charlotte Tilbury Pillow Talk on neutral cream backdrop, Macy's logo upper left.",
    },
    {
        "placement": "email",
        "dimensions": "600x800",
        "headline": "For the Mom who set the standard",
        "subhead": "Hand-picked Beauty gifts she'll actually use. Star Rewards members get free shipping over $50.",
        "cta": "Shop the edit",
        "notes": "Editorial layout: 3-up product grid above the fold, then loyalty bonus, then in-store call-out.",
    },
    {
        "placement": "mobile",
        "dimensions": "414x896",
        "headline": "Spring Blooms, Bold Lips",
        "subhead": "25% off Beauty. Free gift $75+.",
        "cta": "Shop now",
        "notes": "Vertical product carousel; CTA pinned at bottom for thumb reach.",
    },
    {
        "placement": "in_store_signage",
        "dimensions": "1080x1920",
        "headline": "Bold lips. Warm hearts.",
        "subhead": "Mother's Day Beauty. 25% off. Today only.",
        "cta": "See associate",
        "notes": "Large-format vertical poster for storefront windows and Beauty counter end caps.",
    },
]


# Step 6: 3 final approval checkpoints. Merna signs off on behalf of these
# stakeholders in the demo flow.
MOCK_APPROVAL_CHECKPOINTS: list[dict[str, Any]] = [
    {
        "name": "Brand Compliance",
        "reviewer": "Brand Council",
        "criteria": "On-voice, on-palette, hero brand presence",
        "status": "approved",
        "reviewed_at": "ready for sign off",
    },
    {
        "name": "Legal Review",
        "reviewer": "Promotional Compliance",
        "criteria": "Discount T&Cs, Star Rewards exclusivity language, GWP disclosure",
        "status": "approved",
        "reviewed_at": "ready for sign off",
    },
    {
        "name": "VP Marketing",
        "reviewer": "VP of Marketing",
        "criteria": "Strategy alignment with Q2 plan, budget within envelope",
        "status": "approved",
        "reviewed_at": "ready for sign off",
    },
]


# Step 8: 5 channel deployments scheduled for activation.
MOCK_CHANNEL_SCHEDULE: list[dict[str, Any]] = [
    {
        "channel": "email",
        "deployment_time": "Tuesday 6:30 AM ET",
        "audience": "Star Rewards Beauty preference, all tiers",
        "expected_volume": "2.4M recipients",
        "status": "scheduled",
    },
    {
        "channel": "web",
        "deployment_time": "Wednesday 12:00 AM ET",
        "audience": "macys.com homepage hero + Beauty category page",
        "expected_volume": "Approx. 1.8M weekly sessions",
        "status": "scheduled",
    },
    {
        "channel": "mobile",
        "deployment_time": "Wednesday 12:00 AM ET",
        "audience": "Macy's app Beauty tab + push notification to opt-in users",
        "expected_volume": "Approx. 920K app-active users",
        "status": "scheduled",
    },
    {
        "channel": "in_store",
        "deployment_time": "Thursday rollout, store-by-store",
        "audience": "432 Macy's stores nationwide",
        "expected_volume": "Storefront windows + Beauty counter signage",
        "status": "kit shipping",
    },
    {
        "channel": "paid_social",
        "deployment_time": "Tuesday 9:00 AM ET",
        "audience": "Meta + TikTok lookalikes seeded on VIP Loyalist segment",
        "expected_volume": "12M impressions over 14 days",
        "status": "queued in ad manager",
    },
]


# Step 10: Auto-drafted executive summary. The actual numeric values are
# filled in by the Performance Analyzer skill at step 9; this template is
# what the frontend stitches together.
EXECUTIVE_SUMMARY_TEMPLATE = (
    "The {campaign_name} generated {revenue} in revenue across {days} days, "
    "{budget_phrasing}. {channel_phrase} {segment_phrase} "
    "Looking ahead to the next {forecast_days} days, revenue is forecast to "
    "trend {trend_direction} to {forecast_revenue} (80 percent CI: "
    "{forecast_lower} to {forecast_upper})."
)

# Restore persisted state on module load (after all seeded data is in place).
_restore()
