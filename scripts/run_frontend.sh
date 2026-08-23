#!/usr/bin/env bash
# Runs the React frontend on http://localhost:5173
set -e
cd "$(dirname "$0")/../frontend"
if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies (first run only)..."
  npm install
fi
if [ ! -f .env ]; then
  cp .env.example .env
fi
echo "Starting frontend on http://localhost:5173 ..."
npm run dev
