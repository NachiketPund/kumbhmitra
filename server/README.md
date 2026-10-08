# KumbhMitra Backend

KumbhMitra is a pilgrim assistance application for the Kumbh Mela. This repository contains the backend API service.

## Features

- REST API for places, lost & found, crowd updates, events, announcements, emergency contacts, and SOS alerts
- Supabase Auth integration (JWT verification server-side)
- Role-based access control (USER / ADMIN)
- PostgreSQL database layer with parameterized queries
- Graceful shutdown handling
- Production-ready: PORT from environment, fail-closed CORS, rate limiting

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL (Supabase)
- **Framework:** Zero-dependency Express-like router (`src/core/express.ts`)
- **Auth:** Supabase JWT (HS256, verified with `crypto.timingSafeEqual`)

## Project Structure

```
server/
├── src/
│   ├── config/env.ts          # Environment configuration
│   ├── core/express.ts         # HTTP framework
│   ├── middleware/             # auth, admin, cors, rateLimit, logger, validation
│   ├── controllers/            # HTTP layer
│   ├── services/               # Business logic + DB access
│   ├── routes/                 # Route definitions
│   ├── db/                   # Connection pool, migrations
│   └── server.ts             # Entry point (PORT from env)
├── .env.example              # Environment template
├── package.json
└── tsconfig.json
```

## Environment Variables

Copy `.env.example` to `.env` and fill in real values.

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Supabase connection string | `postgresql://postgres:...@db.xyz.supabase.co:5432/postgres` |
| `SUPABASE_JWT_SECRET` | JWT signing secret (server-side only) | *(from Supabase → API settings)* |
| `CORS_ORIGIN` | Allowed frontend origins (comma-separated) | `https://kumbhmitra.onrender.com` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port (Render sets this automatically) |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | — | Public anon key |
| `DB_MAX_CONNECTIONS` | `20` | Pool size |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Idle timeout |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Connection timeout |

## Quick Start

```bash
cd server
npm install
cp .env.example .env   # then edit .env
npm run dev            # development (tsx)
```

## Production Deployment (Render)

### 1. Build

```bash
cd server
npm install
npm run build     # TypeScript → dist/
```

### 2. Start

```bash
# Render sets PORT automatically. Start command:
npm start         # node dist/server.js
```

The server listens on `PORT` (defaults to 5000 if unset).

### 3. Migrations

Run once after deployment:

```bash
npm run migrate   # node run-migrate.js
```

### 4. Environment on Render

Set these in Render dashboard → Environment:
- `DATABASE_URL` — Supabase connection string
- `SUPABASE_JWT_SECRET` — from Supabase API settings
- `CORS_ORIGIN` — your frontend URL (e.g. `https://kumbhmitra.onrender.com`)
- `NODE_ENV=production`

### 5. Health Check

Render health check path: `/api/health`

```json
{
  "success": true,
  "message": "KumbhMitra server is running",
  "data": {
    "status": "ok",
    "environment": "production",
    "database": { "status": "connected", "provider": "Supabase PostgreSQL", "latencyMs": 12 }
  }
}
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Health check (DB probe) |
| GET | `/api/auth/me` | Bearer | Current user profile |
| PATCH | `/api/auth/me` | Bearer | Update display name / language |
| GET | `/api/lost-found` | — | List reports (filters, pagination) |
| POST | `/api/lost-found` | Bearer | Create report |
| GET | `/api/lost-found/:id` | — | Get report |
| PUT | `/api/lost-found/:id` | Bearer (owner) | Update report |
| DELETE | `/api/lost-found/:id` | Bearer (owner) | Delete report |
| GET | `/api/places` | — | List places |
| GET | `/api/places/nearby` | — | Nearby places (lat/lng) |
| GET | `/api/places/:id` | — | Get place |
| GET | `/api/emergency/contacts` | — | Verified contacts |
| POST | `/api/emergency/sos` | — | Record SOS alert |
| GET | `/api/crowd` | — | Crowd updates |
| GET | `/api/crowd/:placeId` | — | Crowd for a place |
| PATCH | `/api/crowd/:placeId` | ADMIN | Update crowd status |
| GET | `/api/admin/stats` | ADMIN | Dashboard stats |
| GET | `/api/admin/users` | ADMIN | List users |

## Security Notes

- All database queries are parameterized (no SQL injection vectors)
- JWT signature verified with constant-time comparison
- CORS fails closed — no `Access-Control-Allow-Origin` header unless the origin is explicitly allowed
- Rate limiting: 60 req/min per IP, 10 req/min for auth paths
- Stack traces never returned in production
- `.env` is git-ignored; secrets never committed

## Graceful Shutdown

The server handles `SIGINT`/`SIGTERM`:
1. Stops accepting new connections
2. Closes the database pool
3. Exits with code 0

Render sends `SIGTERM` on scale-down/restart.

## Development

```bash
npm run dev      # tsx watch mode
npm run lint     # tsc --noEmit (type check)
npm run build    # compile to dist/
```

## Troubleshooting

- **`EAI_AGAIN` / DNS errors** — transient network issue; retry
- **`DATABASE_URL not set`** — check `.env` file exists in `server/`
- **CORS errors** — verify `CORS_ORIGIN` matches your frontend's exact origin (protocol + host + port)
- **401 on protected routes** — ensure `Authorization: Bearer <token>` header is sent
