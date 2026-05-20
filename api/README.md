# Macy's Marketing Operations API

Local FastAPI backend for the M2 GUI. Wraps the four skills in HTTP endpoints,
serves persona and workflow data, and handles scripted Claude chat replies.
No LLM calls.

## Run

From the repo root:

```bash
uv run uvicorn api.main:app --reload --port 8000
```

Visit http://localhost:8000/docs for the auto generated OpenAPI explorer.

## Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET  | `/health`              | health check, DB and images dir presence |
| GET  | `/personas`            | list of 4 personas (Sarah, Priya, Diego, Anna) |
| GET  | `/workflow/{id}`       | the 10 step workflow with status + my_step flag |
| POST | `/skills/segment`      | run audience-segment-builder |
| POST | `/skills/dam-search`   | run dam-asset-finder |
| POST | `/skills/localize`     | run localization-generator |
| POST | `/skills/analyze`      | run campaign-performance-analyzer |
| POST | `/chat`                | scripted Claude reply, optionally with `action` to trigger a skill |
| GET  | `/images/dam/{name}`   | static DAM image (if `data/images/dam/` exists) |

## Notes

* The skills are loaded via `importlib` since their folder names contain
  hyphens. Each skill module is loaded once at process start and cached for
  re-use across requests.
* Dependencies live in `api/requirements.txt` for documentation, but the
  project is uv managed; install via `uv add fastapi uvicorn pydantic` if
  they are not already in `pyproject.toml`.
