# m3_brain

The M3 AI logic, copied in from the prep repo so the Render backend can serve compliance, brief, revision routing, localization, and activation as HTTP endpoints.

## Source of truth

The canonical version of this code lives at `rsm-msaad/mgt449-milestone03-prep`. Changes to the chained skills, MCP tools, RAG corpus, or orchestrator logic should be made there first and copied back here for deployment. Diverging from the prep repo is discouraged. If a hotfix is unavoidable, propagate it back upstream.

## Layout

* `rag/` knowledge base (12 simulated Macys docs), FAISS indexing pipeline, retrieval module
* `tools/` MCP tools (`check_pricing_conflicts`, `find_dam_assets`, `generate_locale_variants`) plus the SQLite seed
* `orchestrator/` skill invoker, deterministic router (Option A), and agentic loop (Option B)
* `skills/` 5 chained skills (compliance, brief, revision router, localization, activation)
* `mcp_server/` FastMCP server config and manifest (kept for completeness, not exposed by the Render backend)
* `macys_m3.db` seeded SQLite store (renamed from `data/macys.db` so it does not collide with the M2 database in `../data/`)
* `workflow_state.json` starter campaign state (used by the local CLI tools, not by the API endpoints)

## How the FastAPI app reaches in here

The backend at `../api/main.py` adds this folder to `sys.path` at startup and imports the orchestrator and skill invoker as if they lived at the repo root:

```python
import sys, os
M3_BRAIN_DIR = os.path.join(os.path.dirname(__file__), "..", "m3_brain")
sys.path.insert(0, M3_BRAIN_DIR)

from orchestrator.skill_invoker import invoke_skill
```

That preserves the M3 imports as written in the prep repo without rewriting them.

## Notes for deploy

The FAISS index files under `rag/index/` (`index.faiss`, `chunks.json`, `manifest.json`) are committed to this repo even though they are gitignored in the prep repo. Render does not build the index at startup, it reads the committed files. Rebuild locally with:

```
cd m3_brain
python -m rag.build_index
```

The SQLite seed can be regenerated with:

```
cd m3_brain
python -m tools.seed_db
```
