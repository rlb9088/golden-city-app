# Deploy Guide

This repo now includes a Docker-based deploy prep flow and a local startup script.

## Included Files

- `Dockerfile`
- `docker-entrypoint.sh`
- root `.gitignore`
- root `.dockerignore`
- `docs/DEPLOY.md`

## Runtime Model

- Backend runs on port `3001`
- Frontend runs on port `3000`
- The frontend calls `/api/*` by default and Next.js rewrites that traffic to the backend inside the container
- `CORS_ORIGIN` still matters when the backend is reached directly from a browser or when you split services later

## Required Environment Variables

Backend:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_SHEET_ID`
- `JWT_SECRET`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_BOOTSTRAP_AGENT_PASSWORD`
- `CORS_ORIGIN`
- `LOG_DIR` optional. Defaults to `backend/logs`

Frontend:

- `NEXT_PUBLIC_API_URL` only if you want the browser to call a public backend URL directly

## Local Docker

Build the image:

```bash
docker build -t golden-city .
```

Run it locally:

```bash
docker run --rm -p 3000:3000 -p 3001:3001 \
  -v $(pwd)/backend/logs:/app/backend/logs \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/backend/keys/google-vision.json \
  -e GOOGLE_SHEET_ID=your_sheet_id \
  -e JWT_SECRET=your_long_random_secret \
  -e AUTH_BOOTSTRAP_ADMIN_PASSWORD=your_admin_password \
  -e AUTH_BOOTSTRAP_AGENT_PASSWORD=your_agent_password \
  -e CORS_ORIGIN=http://localhost:3000 \
  -e LOG_DIR=/app/backend/logs \
  golden-city
```

Mount the service account JSON into `/app/backend/keys/google-vision.json` if you want real Sheets and OCR access.
In production, backend runtime logs are written as JSON lines into `backend/logs/app-YYYY-MM-DD.log` and also remain visible in stdout/stderr.

## Render

Use the Dockerfile-based service and set secrets in the Render dashboard.

Suggested settings:

1. Create a Web Service from the repository.
2. Use the Dockerfile build.
3. Set `NODE_ENV=production`.
4. Set the backend secrets and `CORS_ORIGIN`.
5. Provide the Google service account file as a mounted secret or file secret.
6. Leave `NEXT_PUBLIC_API_URL` empty unless you deliberately split frontend and backend into separate services.

## Cloud Run

Cloud Run exposes a single public port, so the built-in frontend proxy is the cleanest path.

Suggested settings:

1. Build and push the image to Artifact Registry.
2. Deploy the image to Cloud Run.
3. Expose port `3000` at the platform level.
4. Inject backend secrets with Secret Manager or mounted files.
5. Set `CORS_ORIGIN` to the public frontend origin if you ever call the backend directly from the browser.

If you later split frontend and backend into separate deployments, set `NEXT_PUBLIC_API_URL` to the public backend URL and keep `CORS_ORIGIN` aligned with the frontend origin.

## Secret Management

Do not bake secrets into the image.

Keep these values outside the repo and outside the container image:

- `JWT_SECRET`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_BOOTSTRAP_AGENT_PASSWORD`
- `GOOGLE_APPLICATION_CREDENTIALS`

On GCP, use Secret Manager or a mounted secret file for the service account JSON.
