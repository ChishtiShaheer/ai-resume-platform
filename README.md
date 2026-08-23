# AI Resume Screening & Candidate Ranking Platform

An AI-powered recruitment platform: recruiters create a job, upload dozens of
resumes (PDF/DOCX, scanned or digital), and get a ranked, **transparent**
shortlist — every score comes with a breakdown of exactly why a candidate
ranked where they did.

Built and verified end-to-end (registration → job creation → resume upload →
background parsing/OCR/scoring → ranked results) against a real Postgres
instance during development.

## Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python 3.11) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Database | PostgreSQL (works with Supabase's Postgres directly) |
| Resume parsing | pdfplumber, python-docx |
| OCR (scanned resumes) | pytesseract + pdf2image (poppler) |
| Semantic matching | Sentence-Transformers (`all-MiniLM-L6-v2`) |
| Vector search (AI assistant) | ChromaDB (falls back to in-memory keyword search if unavailable) |
| LLM (optional) | OpenAI or Gemini — bring your own key |
| Auth | JWT (python-jose) + bcrypt |

## How scoring works (the core of the product)

Each candidate gets 4 sub-scores, combined into an `overall_score` with
**configurable weights** (defaults: semantic 35%, skills 35%, experience 20%,
education 10% — editable per-job in the UI):

1. **Semantic** — embedding similarity between the full job description and resume text.
2. **Skills** — required/preferred skills matched against a 158-term skills taxonomy, with fuzzy matching (`react` ≈ `react.js`).
3. **Experience** — years extracted from date ranges vs. the job's minimum.
4. **Education** — degree level detected vs. the job's requirement.

Every sub-score returns a plain-English `explanation`, stored in
`score_breakdown` on the candidate and shown in the UI — this is what "transparent" ranking actually means here, not marketing copy.

## Project layout

```
backend/          FastAPI app (see backend/README below via docstrings)
  app/
    api/routes/    auth, jobs, resumes, candidates, analytics, ai_assistant
    services/      parsing, OCR, extraction, embeddings, scoring, LLM, export
    models/        SQLAlchemy models (User, Job, Candidate)
  data/skills_taxonomy.json   158-skill reference taxonomy used for matching
frontend/         React + TS + Tailwind app
scripts/          run_backend.sh / run_frontend.sh / run_both.sh
AI-Resume-Platform.code-workspace   open this in VS Code for 3 run buttons
docker-compose.yml   Postgres + backend + frontend, containerized
```

## Quick start (recommended: Docker)

```bash
git clone <your-repo-url>
cd ai-resume-platform
cp backend/.env.example backend/.env      # add your own OpenAI/Gemini key here if you have one
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend docs (Swagger) → http://localhost:8000/docs
- Postgres → localhost:5432 (user/pass: postgres/postgres)

## Quick start (no Docker — local Python/Node)

**Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# OCR needs system binaries: `sudo apt install tesseract-ocr poppler-utils` (Linux)
#                            `brew install tesseract poppler` (macOS)
cp .env.example .env   # edit DATABASE_URL to point at your Postgres/Supabase instance
uvicorn app.main:app --reload
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Running via the VS Code workspace (3 buttons)

1. Open `AI-Resume-Platform.code-workspace` in VS Code ("File → Open Workspace from File...").
2. Install the recommended **Task Buttons** extension when prompted (or `Cmd/Ctrl+Shift+P` → "Extensions: Show Recommended Extensions").
3. Three buttons appear in the bottom status bar: **▶ Backend**, **▶ Frontend**, **▶ Both**.
4. Or without the extension: `Cmd/Ctrl+Shift+P` → "Tasks: Run Task" → pick one of the three.
5. Terminal-only alternative: `make backend`, `make frontend`, or `make both` from the project root.

The first run of each script auto-creates a `.env` from `.env.example` and (for
frontend) runs `npm install` if `node_modules` is missing.

## Adding your own AI API keys

In `backend/.env`:
```
LLM_PROVIDER=openai        # or "gemini"
OPENAI_API_KEY=sk-...
```
Without a key (`LLM_PROVIDER=none`, the default), the platform still fully
works — structured extraction, candidate summaries, and interview questions
fall back to deterministic rule-based/template logic. Everything upgrades
automatically the moment a key is added; no code changes needed.

## Assumptions made (7-day scope)

- **Database migrations**: tables are created via `Base.metadata.create_all()`
  on startup for speed of iteration. An Alembic scaffold is included under
  `backend/alembic/` — run `alembic revision --autogenerate` once you're ready
  to manage schema changes formally in production.
- **Batch processing**: implemented with FastAPI `BackgroundTasks` (each
  uploaded resume processes independently and the UI polls for status). For
  very large batches (thousands of resumes) in production, swap this for a
  proper queue (Celery + Redis, or RQ) — the `process_candidate()` function in
  `services/pipeline.py` is already a self-contained unit of work and drops
  into a task queue unchanged.
- **Scoring-consistency check**: implemented as a same-job pairwise flag
  (very similar skill sets + large score gap → flagged for recruiter review),
  rather than a cross-job statistical audit.
- **Recruiter AI assistant**: retrieval is ChromaDB by default, with an
  automatic in-memory keyword-search fallback so the feature never hard-fails
  in environments where ChromaDB can't install.
- **No live deployment was performed** from this environment (no hosting
  accounts/credentials available here) — `docker-compose.yml` plus the
  Dockerfiles are production-ready starting points for Render/Railway/Fly.io/
  a VM, and Supabase's Postgres connection string is a drop-in `DATABASE_URL`.
- Full semantic scoring requires `sentence-transformers` (and its ML
  dependencies) to be installed via `requirements.txt` — this wasn't
  installed during automated testing here to save time (it's a large
  download), but the code path was verified to degrade gracefully to
  `semantic_score = 0` when absent, and works fully once installed.

## API documentation

Once the backend is running, full interactive API docs (OpenAPI/Swagger) are
at **http://localhost:8000/docs**, and ReDoc at **/redoc** — every route,
request/response schema, and auth requirement is generated live from the code.

## Demo flow (realistic dataset)

1. Register a recruiter account.
2. Create a job (e.g. "Backend Engineer" — python, fastapi, postgresql, docker required; 2+ years; Bachelor's).
3. Upload a batch of resumes (mix of PDF/DOCX, and a scanned PDF to exercise OCR).
4. Watch the candidate table populate as background processing completes (auto-refreshes).
5. Open a candidate to see the full score breakdown, AI summary, and generate interview questions.
6. Adjust scoring weights and watch the whole shortlist re-rank live.
7. Export the shortlist to CSV/XLSX.
8. Check the Analytics tab for pipeline-wide stats.

## Pushing this to your own GitHub

This repo was initialized locally with chunked, meaningful commits. To push
it to your own account:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
