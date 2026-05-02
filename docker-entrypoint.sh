#!/bin/sh
set -e

echo "Golden City Backoffice - production startup"

_term() {
  echo "Caught signal, shutting down..."
  kill -TERM "$BACKEND_PID" 2>/dev/null
  kill -TERM "$FRONTEND_PID" 2>/dev/null
}

trap _term TERM INT

cd /app/backend
echo "Starting backend on port 3001"
node index.js &
BACKEND_PID=$!

cd /app/frontend
echo "Starting frontend on port 3000"
npm run start -- --hostname 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
