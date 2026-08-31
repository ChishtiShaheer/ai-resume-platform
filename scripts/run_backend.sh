#!/usr/bin/env bash
# Runs the FastAPI backend on http://localhost:8000
# Requires: Postgres running and reachable at backend/.env's DATABASE_URL,
# and `pip install -r backend/requirements.txt` already done
# (ideally inside a virtualenv — see README).
set -e
cd "$(dirname "$0")/../backend"
if [ ! -f .env ]; then
  echo "No backend/.env found — copying from .env.example (edit it to add your API keys)."
  cp .env.example .env
fi
if [ -d .venv ]; then
  source .venv/bin/activate
elif [ -d ../.venv ]; then
  source ../.venv/bin/activate
fi
echo "Starting backend on http://localhost:8000 ..."
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
