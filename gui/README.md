# Macy's Marketing Operations GUI

Next.js 14 + Tailwind frontend for the May 7 demo. Pairs with the FastAPI
backend in `../api/`. Both run locally.

## Run

Terminal 1 (backend):

```bash
cd ..
uv run uvicorn api.main:app --reload --port 8000
```

Terminal 2 (frontend):

```bash
npm install     # first time only
npm run dev     # http://localhost:3000
```

## Layout

* `app/page.tsx` is the landing/role selector. Pick a persona to enter.
* `app/{persona}/page.tsx` are the four persona consoles. Each composes the
  shared `PersonaShell` (top bar + left nav + workflow pipeline + skill cards
  + chat sidebar).
* `components/` are the reusable UI parts.
* `lib/api.ts` is the typed wrapper around the FastAPI endpoints.

## Notes

* The chat is fully scripted on the backend (`/chat`). No LLM calls.
* Each persona's "Run" button opens the same `ResultsModal` with the right
  inputs and renders the skill output. Chat replies that include an `action`
  trigger the same modal pre-filled.
* DAM thumbnails are loaded from `http://localhost:8000/images/dam/<filename>`.
  If `data/images/dam/` is empty (the Unsplash downloader was never run), the
  thumbnails just show a "no preview" placeholder; ranking still works.
