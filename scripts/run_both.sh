#!/usr/bin/env bash
# Runs backend + frontend together in one terminal, tearing both down
# together on Ctrl+C.
set -e
cd "$(dirname "$0")"
trap 'kill 0' EXIT

./run_backend.sh &
BACKEND_PID=$!

./run_frontend.sh &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000  (docs at /docs)"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."
echo ""

wait $BACKEND_PID $FRONTEND_PID
