#!/usr/bin/env bash
# Runs backend + frontend together in one terminal, tearing both down
# together on Ctrl+C.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

trap 'kill 0' EXIT INT TERM

"$SCRIPT_DIR/run_backend.sh" &
BACKEND_PID=$!

"$SCRIPT_DIR/run_frontend.sh" &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000  (docs at /docs)"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."
echo ""

wait $BACKEND_PID $FRONTEND_PID
