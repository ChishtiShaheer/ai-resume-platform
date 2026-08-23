.PHONY: backend frontend both install-backend install-frontend

## Run the FastAPI backend (http://localhost:8000)
backend:
	@bash scripts/run_backend.sh

## Run the React frontend (http://localhost:5173)
frontend:
	@bash scripts/run_frontend.sh

## Run backend + frontend together
both:
	@bash scripts/run_both.sh

## One-time setup: backend virtualenv + deps
install-backend:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

## One-time setup: frontend deps
install-frontend:
	cd frontend && npm install
