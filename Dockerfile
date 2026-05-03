FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/. .

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/. .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=
RUN npm run build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=backend-build /app/backend ./backend
COPY --from=frontend-build /app/frontend ./frontend

RUN mkdir -p /app/backend/keys

RUN printf '#!/bin/sh\nset -e\n\n_term() {\n  echo "Caught signal, shutting down..."\n  kill -TERM "$BACKEND_PID" 2>/dev/null\n  kill -TERM "$FRONTEND_PID" 2>/dev/null\n}\n\ntrap _term TERM INT\n\ncd /app/backend\necho "Starting backend on port 3001"\nnode index.js &\nBACKEND_PID=$!\n\ncd /app/frontend\necho "Starting frontend on port 3000"\nnpm run start -- --hostname 0.0.0.0 --port 3000 &\nFRONTEND_PID=$!\n\nwait "$BACKEND_PID" "$FRONTEND_PID"\n' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
