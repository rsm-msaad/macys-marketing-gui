"""In-memory campaign state for the demo.

Single process state. Render free tier runs one worker, so this is fine for
the demo, but it does NOT survive a server restart and would not be coherent
across multiple workers. That's the trade off for keeping the demo trivial.
For production we would back this with sqlite or postgres.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

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


def _initial_state() -> dict[str, Any]:
    return {
        "current_step": 1,
        "completed_steps": [],
        "step_outputs": {},
        "history": [],
        # Revision tracking: per-step list of past revision requests.
        "revisions": {},
        # When a revision is in flight, holds the metadata; None otherwise.
        "pending_revision": None,
    }


_STATE: dict[str, dict[str, Any]] = {DEMO_CAMPAIGN_ID: _initial_state()}


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
        return _snapshot(s)


def reset(campaign_id: str) -> dict[str, Any]:
    with _LOCK:
        if campaign_id not in _STATE:
            raise KeyError(f"unknown campaign: {campaign_id}")
        _STATE[campaign_id] = _initial_state()
        return _snapshot(_STATE[campaign_id])


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
        return _snapshot(s)


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
        return _snapshot(s)


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
