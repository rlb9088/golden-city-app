#!/bin/sh
set -e

echo "Golden City Backoffice - production startup"

cd /app/backend
echo "Starting backend on port 3001"
node index.js &
BACKEND_PID=$!

cd /app/frontend
echo "Starting frontend on port 3000"
npm run start -- --hostname 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
