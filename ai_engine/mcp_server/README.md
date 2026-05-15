# mcp_server

MCP server and manifest for the Macys M3 tool layer.

## Overview

This folder contains:

* [server.py](server.py) the runnable MCP server (FastMCP, stdio transport)
* [manifest.json](manifest.json) a static descriptor of the three tools with full input and output schemas (for grading and human reference, not consumed at runtime)
* [claude_desktop_config_example.json](claude_desktop_config_example.json) paste this into your Claude Desktop config to wire up the server
* [__init__.py](__init__.py) package marker so `python -m mcp_server.server` resolves cleanly
* [README.md](README.md) this file

## The three tools

| Tool | Purpose | Inputs | Outputs | Workflow step | Called by skill |
|------|---------|--------|---------|---------------|-----------------|
| check_pricing_conflicts | Validate a SKU list against MAP rules and stacking limits | sku_ids, proposed_discount_pct | status, conflicts, checked_count | 6a | compliance-pre-check |
| find_dam_assets | Look up DAM assets by category and region with active rights | category, region, max_results | status, assets, result_count | 7 | localization-generator |
| generate_locale_variants | Transcreate copy into Spanish (es) or Quebec French (fr-CA) | copy, target_language, regional_pricing | status, translated_copy, applied_phrases | 7 | localization-generator |

## Running the server locally

From the repo root:

```
python -m mcp_server.server
```

This starts a stdio MCP server. The server waits for a client on stdin and writes responses to stdout, so it is most useful when wired into a client like Claude Desktop.

You can also run it directly as a script:

```
python mcp_server/server.py
```

Either invocation works. The folder is named `mcp_server` (not `mcp`) so it does not shadow the installed `mcp` SDK as a Python package.

## Wiring into Claude Desktop

1. Locate the Claude Desktop config on macOS:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

If the file does not exist yet, open Claude Desktop once, then close it. The empty file will appear.

2. Open the file. Merge the `mcpServers` block from [claude_desktop_config_example.json](claude_desktop_config_example.json) into your config. Replace the `cwd` value with the absolute path to your local clone of this repo.

3. Restart Claude Desktop. The three tools should appear in the tool picker.

## Verifying the tools work standalone

Each tool is also a runnable Python module with a CLI. This is the fastest way to confirm the underlying logic works without going through MCP:

```
python -m tools.check_pricing_conflicts BTY-001 BTY-045 BTY-112 --discount 40
python -m tools.find_dam_assets Beauty FL --max 3
python -m tools.generate_locale_variants "Up to 40 percent off. Refresh your routine." es
```

The pytest suite at [../tests/test_tools.py](../tests/test_tools.py) covers the pass, warn, and fail paths of each tool. The smoke test at [../tests/test_mcp_smoke.py](../tests/test_mcp_smoke.py) runs one realistic call against each tool and prints the result.

## Why the folder is named mcp_server

A folder named `mcp/` would shadow the installed `mcp` SDK when Python resolved imports, breaking `from mcp.server.fastmcp import FastMCP`. The rename to `mcp_server/` removes the collision so the server can be imported and run as a normal Python module.
