## Post Analysis – Slack Sentiment App

Slack bot that tracks message replies and emoji reactions, calculates sentiment, and shows a live summary modal via a message shortcut. Built with Node.js, Express, Slack Events API, and PostgreSQL (Render).

### Stack
- Node.js 20+, Express 5
- Slack Web API + Events API (HTTP, no Socket Mode)
- Sentiment libraries: `sentiment`, `emoji-sentiment`, `node-emoji`
- PostgreSQL (`pg`)
- Hosted on Render (web service + Render Postgres)

### Features
- Auto-captures channel messages, replies, and reactions after installation.
- Computes emoji sentiment (per reaction) and textual sentiment (per reply) with rolling aggregates.
- Stores messages, replies, reactions, and sentiment scores in Postgres.
- Message shortcut “Post Analysis” opens a modal with:
  - Combined sentiment score
  - Total replies + individual reply tone
  - Reaction breakdown with participating users
  - Channel + timestamp metadata

### Slack App Configuration
1. Create app “Post Analysis” in Slack API dashboard.
2. **OAuth scopes** (bot): `channels:history`, `channels:read`, `chat:write`, `reactions:read`, `users:read` (+ private channel scopes if needed).
3. Install to workspace → copy Bot Token (`SLACK_BOT_TOKEN`) and Signing Secret.
4. **Event Subscriptions**: enable, set Request URL to `https://<render-app>.onrender.com/slack/events`, subscribe to `message.channels`, `reaction_added`, `reaction_removed`.
5. **Interactivity & Shortcuts**: enable, Request URL `https://<render-app>.onrender.com/slack/interactions`, add Message Shortcut:
   - Name: `Post Analysis`
   - Callback ID: `post_analysis_shortcut`
6. No slash commands, no Socket Mode.

### Environment
Copy `.env.example` → `.env`:
```
SLACK_SIGNING_SECRET=...
SLACK_BOT_TOKEN=...
DATABASE_URL=postgres://...
GOOGLE_API_KEY=             # optional
PORT=3000
```

### Install & Run
```bash
npm install
npm run dev   # (add nodemon if desired) 
npm start     # node src/server.js
```

### Database
Run the migration against Render Postgres (or local) before starting the server:
```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```
Tables:
- `messages`: base message info + sentiment aggregates
- `replies`: thread replies with per-reply sentiment
- `reactions`: emoji reactions with user + timestamp

### HTTP Endpoints
- `POST /slack/events` – Slack Events API (messages, reactions)
- `POST /slack/interactions` – message shortcut payloads
- `GET /health` – health check for Render

### Development Notes
- Event handlers automatically upsert message metadata (fetching user/channel info via Slack Web API) and recalc sentiment scores after each reply/reaction.
- Message shortcut triggers a modal built with Block Kit summarizing reactions, replies, and sentiment.
- Extendable: add App Home onboarding, scheduled reports, dashboards, or Google Generative AI summaries using `GOOGLE_API_KEY`.


