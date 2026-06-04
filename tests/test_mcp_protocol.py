"""Phase 1 isolation test: call check_pricing_conflicts over real MCP protocol.

Launches the FastMCP server as a subprocess via stdio transport, calls the
tool through an MCP ClientSession, and asserts the result matches the direct
Python function call for the same input.

Marked @pytest.mark.integration since it spawns the server process.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
AI_ENGINE = REPO_ROOT / "ai_engine"

if str(AI_ENGINE) not in sys.path:
    sys.path.insert(0, str(AI_ENGINE))

from tools.check_pricing_conflicts import (  # noqa: E402
    check_pricing_conflicts as direct_check,
)


async def _call_via_mcp(sku_ids: list[str], discount_pct: float) -> dict:
    """Launch the MCP server and call check_pricing_conflicts over the protocol."""
    from mcp.client.session import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client

    server_params = StdioServerParameters(
        command="uv",
        args=["run", "python", "-m", "mcp_servers.macys_marketing"],
        cwd=str(REPO_ROOT),
        env={"PYTHONPATH": str(REPO_ROOT / "ai_engine")},
    )

    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            result = await session.call_tool(
                "check_pricing_conflicts",
                arguments={
                    "sku_ids": sku_ids,
                    "proposed_discount_pct": discount_pct,
                },
            )

            # MCP returns content as a list of TextContent objects
            text = result.content[0].text
            return json.loads(text)


@pytest.mark.integration
def test_mcp_protocol_matches_direct_call():
    """MCP protocol result must match direct Python function call."""
    sku_ids = ["MAC-001", "EL-001"]
    discount_pct = 25.0

    # Direct call (the current runtime path)
    direct_result = direct_check(sku_ids, discount_pct)

    # MCP protocol call (launches server subprocess)
    protocol_result = asyncio.run(_call_via_mcp(sku_ids, discount_pct))

    # Results must match on the key fields
    assert protocol_result["status"] == direct_result["status"], (
        f"Status mismatch: protocol={protocol_result['status']}, direct={direct_result['status']}"
    )
    assert protocol_result["checked_count"] == direct_result["checked_count"], (
        f"Count mismatch: protocol={protocol_result['checked_count']}, direct={direct_result['checked_count']}"
    )
    assert len(protocol_result.get("conflicts", [])) == len(direct_result.get("conflicts", [])), (
        f"Conflicts count mismatch"
    )
