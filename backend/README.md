# Feedback Backend

Express + SQLite ingest backend that forwards incoming feedback to Discord webhooks.

## Required Env Vars

- `FEEDBACK_INGEST_KEY`: API key expected in `X-Feedback-Key` for `POST /tripFeedback` and `POST /featureRequests`.
- `DISCORD_WEBHOOK_TRIP_FEEDBACK`: Discord webhook URL for trip feedback channel.
- `DISCORD_WEBHOOK_FEATURE_REQUESTS`: Discord webhook URL for feature-request channel.

## Optional Env Vars

- `DISCORD_WEBHOOK_TRIP_DOWN`: overrides thumbs-down trip feedback to a separate Discord channel.
- `FEEDBACK_ALERT_WEBHOOK_URL`: fallback webhook if a Discord-specific webhook is missing.
- `PORT`: server port (default `4000`)
- `FEEDBACK_DB_PATH`: SQLite path (default `./data/feedback.sqlite`)
- `NODE_ENV`: use `production` to disable verbose request logging.

## Local Run

```bash
cd backend
npm install
npm run migrate
FEEDBACK_INGEST_KEY=dev-ingest-key \
DISCORD_WEBHOOK_TRIP_FEEDBACK=https://discord.com/api/webhooks/... \
DISCORD_WEBHOOK_FEATURE_REQUESTS=https://discord.com/api/webhooks/... \
npm run dev
```

Server: `http://localhost:4000`

- Health: `GET /health`
- Ingest:
  - `POST /tripFeedback`
  - `POST /featureRequests`

## App Wiring

In app `.env`:

```bash
EXPO_PUBLIC_FEEDBACK_API_BASE_URL=https://YOUR_BACKEND
EXPO_PUBLIC_FEEDBACK_API_KEY=YOUR_FEEDBACK_INGEST_KEY
```

## Discord Routing

- Trip feedback -> `DISCORD_WEBHOOK_TRIP_FEEDBACK`
- Trip thumbs-down -> `DISCORD_WEBHOOK_TRIP_DOWN` (if set), otherwise trip webhook
- Feature requests -> `DISCORD_WEBHOOK_FEATURE_REQUESTS`

Webhook payload includes both `content` and `text` for Discord/Slack compatibility.

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
   - `DISCORD_WEBHOOK_TRIP_FEEDBACK`
   - `DISCORD_WEBHOOK_FEATURE_REQUESTS`
   - Optional: `DISCORD_WEBHOOK_TRIP_DOWN`
   - Optional: `FEEDBACK_ALERT_WEBHOOK_URL`
   - `FEEDBACK_DB_PATH=/opt/render/project/src/backend/data/feedback.sqlite`
   - `NODE_ENV=production`
7. Deploy and copy your service URL.
8. In app `.env`, set `EXPO_PUBLIC_FEEDBACK_API_BASE_URL` to that URL.
