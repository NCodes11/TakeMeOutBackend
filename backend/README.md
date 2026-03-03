# Feedback Backend

Minimal Express + SQLite backend for beta feedback ingestion, admin review, and export.

## Required Env Vars

- `FEEDBACK_INGEST_KEY`: API key expected in `X-Feedback-Key` for `POST /tripFeedback` and `POST /featureRequests`.
- `ADMIN_TOKEN`: token required for `/admin` and `/admin/export/*`.

## Optional Env Vars

- `PORT`: server port (default `4000`)
- `FEEDBACK_DB_PATH`: SQLite path (default `./data/feedback.sqlite`)
- `NODE_ENV`: use `production` to disable verbose request logging.

## Local Run

```bash
cd backend
npm install
npm run migrate
npm run dev
```

Server: `http://localhost:4000`

- Health: `GET /health`
- Ingest:
  - `POST /tripFeedback`
  - `POST /featureRequests`
- Admin: `GET /admin?token=YOUR_ADMIN_TOKEN`

## Tests

```bash
cd backend
npm test
```

## Deploy on Render (recommended)

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Set Root Directory to `backend`.
4. Build Command: `npm install && npm run build`
5. Start Command: `npm run start`
6. Add environment variables:
   - `FEEDBACK_INGEST_KEY`
   - `ADMIN_TOKEN`
   - `FEEDBACK_DB_PATH=/opt/render/project/src/backend/data/feedback.sqlite`
   - `NODE_ENV=production`
7. Deploy and copy your service URL.
8. In the app env, set `EXPO_PUBLIC_FEEDBACK_API_BASE_URL` to that URL.

Note: Render disks are ephemeral unless you attach persistent storage. For long-term retention, attach a disk or migrate to managed Postgres.
