"""
Deterministic helpers for the activation scheduler skill.

The LLM has no business doing timezone math. These helpers handle send time
computation, peak engagement windows by channel, and frequency cap rules.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

REGION_TIMEZONE = {
    "NY": "America/New_York",
    "FL": "America/New_York",
    "CA": "America/Los_Angeles",
    "TX": "America/Chicago",
    "PR": "America/Puerto_Rico",
    "QC": "America/Toronto",
}


def region_to_timezone(region: str) -> str:
    """Return the IANA timezone for a region. Defaults to America/New_York."""
    return REGION_TIMEZONE.get(region, "America/New_York")


def compute_send_time(tz_name: str, launch_date: str, hour_local: int = 10) -> str:
    """Compute the UTC ISO 8601 timestamp for a local hour send.

    launch_date is a date string in YYYY MM DD form (with the dashes
    required by ISO 8601). hour_local defaults to 10 (10 AM local), the
    standard email send slot for the morning waking customer.
    """
    tz = ZoneInfo(tz_name)
    local_dt = datetime.fromisoformat(launch_date).replace(
        hour=hour_local, minute=0, second=0, tzinfo=tz
    )
    utc_dt = local_dt.astimezone(timezone.utc)
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def peak_social_window(tz_name: str) -> str:
    """Return the standard 6 PM to 9 PM local window as a string.

    Informational. The actual platform scheduling is handled by the channel
    team using this window as the guide.
    """
    return "18:00 to 21:00"


def display_cap(estimated_spend: int, region: str) -> int:
    """Return the frequency cap (impressions per user per day) for display.

    Default cap is 3. Spend above $500K raises the cap to 4 to support the
    higher reach goal. The region argument is accepted for future per market
    overrides but is not currently used in the rule.
    """
    if estimated_spend > 500_000:
        return 4
    return 3


def signage_window(tz_name: str) -> str:
    """Return the in store signage window aligned with standard store hours."""
    return "10:00 to 21:00"


def assemble_schedule(per_region: list[dict], retrieved_docs: list[str]) -> dict:
    """Package the schedule object for workflow_state.json."""
    return {
        "schedule_by_region": per_region,
        "human_confirmation_required": True,
        "retrieved_docs": retrieved_docs,
    }
