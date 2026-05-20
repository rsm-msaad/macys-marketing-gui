"""Reference orchestrator for M3 grading.

Matches the customer-ticket-process-rag template pattern: a standalone
Python web server that drives the campaign workflow step by step.

The production app is at https://macysai.vercel.app with a richer
Next.js + FastAPI stack. This file provides a minimal local demo that
a grader can run with:

    uv run python milestone03/scripts/orchestrator.py

Then open http://localhost:8765 in a browser.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from string import Template
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

AI_ENGINE = REPO_ROOT / "ai_engine"
if str(AI_ENGINE) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE))

# Import our real orchestrator and state modules.
from api import state as campaign_state  # noqa: E402

STEP_LABELS = campaign_state.STEP_NAMES

# Step scripts: maps step number to automation/skill module path.
STEP_SCRIPTS = {
    1: {"name": "Briefing", "type": "human", "module": None},
    2: {
        "name": "Segmentation",
        "type": "automation",
        "module": "ai_engine/automations/audience-segment-builder/segment.py",
    },
    3: {"name": "SKU Selection", "type": "automation", "module": "ai_engine/automations/sku-recommender/recommend.py"},
    4: {
        "name": "Creative Production",
        "type": "automation",
        "module": "ai_engine/automations/dam-asset-finder/search.py",
    },
    5: {"name": "Layout Assembly", "type": "skill", "module": "ai_engine/skills/layout-copy-generator/helpers.py"},
    6: {"name": "Final Approval", "type": "skill", "module": "ai_engine/skills/compliance-pre-check/helpers.py"},
    7: {
        "name": "Localization",
        "type": "automation",
        "module": "ai_engine/automations/localization-generator-v1/generate.py",
    },
    8: {"name": "Activation", "type": "automation", "module": "ai_engine/automations/activation-scheduler/helpers.py"},
    9: {
        "name": "Monitoring",
        "type": "automation",
        "module": "ai_engine/automations/campaign-performance-analyzer/analyze.py",
    },
    10: {"name": "Reporting", "type": "human", "module": None},
}


def get_campaign_state() -> dict:
    """Return the current demo campaign state."""
    s = campaign_state.get_state(campaign_state.DEMO_CAMPAIGN_ID)
    if s is None:
        return {"current_step": 1, "completed_steps": [], "is_complete": False}
    return s


def advance_step() -> dict:
    """Advance the demo campaign one step."""
    s = get_campaign_state()
    step = s["current_step"]
    if step > 10 or s.get("is_complete"):
        return {"error": "Campaign is already complete."}
    try:
        result = campaign_state.advance(
            campaign_state.DEMO_CAMPAIGN_ID,
            step,
            f"Step {step} approved via reference orchestrator",
        )
        return result
    except (KeyError, ValueError) as exc:
        return {"error": str(exc)}


def reset_campaign() -> dict:
    """Reset the demo campaign to step 1."""
    return campaign_state.reset(campaign_state.DEMO_CAMPAIGN_ID)


def build_summary() -> dict:
    """Build a summary for the browser UI."""
    s = get_campaign_state()
    steps = []
    for i in range(1, 11):
        info = STEP_SCRIPTS[i]
        if i in s.get("completed_steps", []):
            status = "completed"
        elif i == s.get("current_step"):
            status = "active"
        else:
            status = "pending"
        steps.append(
            {
                "number": i,
                "name": info["name"],
                "type": info["type"],
                "status": status,
                "output": s.get("step_outputs", {}).get(str(i)),
            }
        )
    return {
        "campaign_id": campaign_state.DEMO_CAMPAIGN_ID,
        "campaign_name": "Mother's Day Beauty Event",
        "current_step": s.get("current_step", 1),
        "is_complete": s.get("is_complete", False),
        "steps": steps,
    }


def json_response(handler: BaseHTTPRequestHandler, data: dict, status: int = 200) -> None:
    body = json.dumps(data, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def html_response(handler: BaseHTTPRequestHandler, body: str) -> None:
    encoded = body.encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "text/html; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def render_index() -> str:
    template_path = Path(__file__).with_name("orchestrator_ui.html")
    return template_path.read_text(encoding="utf-8")


class OrchestratorHandler(BaseHTTPRequestHandler):
    server_version = "MacysWorkflowDemo/1.0"

    def log_message(self, fmt, *args):
        print(f"  {fmt % args}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            html_response(self, render_index())
        elif path == "/api/state":
            json_response(self, build_summary())
        elif path == "/api/health":
            json_response(self, {"status": "ok"})
        else:
            self.send_error(404, "Not found")

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/advance":
            result = advance_step()
            json_response(self, {"state": build_summary(), "result": result})
        elif path == "/api/reset":
            reset_campaign()
            json_response(self, build_summary())
        else:
            self.send_error(404, "Not found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def main():
    parser = argparse.ArgumentParser(description="Macys campaign workflow demo server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), OrchestratorHandler)
    print(f"Macys workflow demo running at http://{args.host}:{args.port}")
    print(f"Production app: https://macysai.vercel.app")
    print(f"Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
