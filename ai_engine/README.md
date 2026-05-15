# ai_engine

The AI logic for chained skills, automations, MCP tools, RAG, and orchestration. The Render backend serves compliance, brief, revision routing, localization, and activation as HTTP endpoints.

## Layout

* `skills/` LLM driven skills that require genuine judgment (compliance pre check, approval brief generator, revision router)
* `automations/` deterministic steps with no LLM calls (localization generator, activation scheduler, plus the 4 M2 skills)
* `rag/` knowledge base (12 simulated Macys docs), FAISS indexing pipeline, retrieval module
* `tools/` MCP tools (`check_pricing_conflicts`, `find_dam_assets`, `generate_locale_variants`) plus the SQLite seed
* `orchestrator/` skill invoker, deterministic router (Option A), and agentic loop (Option B)
* `mcp_server/` FastMCP server config and manifest (kept for completeness, not exposed by the Render backend)
* `macys_m3.db` seeded SQLite store (renamed from `data/macys.db` so it does not collide with the M2 database in `../data/`)
* `workflow_state.json` starter campaign state (used by the local CLI tools, not by the API endpoints)

## Skills vs Automations

Following the professor's reference pattern:

* **Skills** (`skills/`): steps where an LLM makes a judgment call that deterministic rules cannot handle. Each skill has a `SKILL.md` instruction file.
* **Automations** (`automations/`): steps that are 100% deterministic (dict lookups, timezone math, rule based scoring, database queries). No `SKILL.md` file, no LLM calls.

## How the FastAPI app reaches in here

The backend at `../api/main.py` adds this folder to `sys.path` at startup and imports the orchestrator and skill invoker as if they lived at the repo root:

```python
import sys, os
AI_ENGINE_DIR = os.path.join(os.path.dirname(__file__), "..", "ai_engine")
sys.path.insert(0, AI_ENGINE_DIR)

from orchestrator.skill_invoker import invoke_skill
```

## Notes for deploy

The FAISS index files under `rag/index/` (`index.faiss`, `chunks.json`, `manifest.json`) are committed to this repo even though they are gitignored in the prep repo. Render does not build the index at startup, it reads the committed files. Rebuild locally with:

```
cd ai_engine
python -m rag.build_index
```

The SQLite seed can be regenerated with:

```
cd ai_engine
python -m tools.seed_db
```
