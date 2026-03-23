# Workspace

## Overview

Live Music Tracker — A social app for tracking live music shows, coordinating with friends, and never missing a show in your city.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Replit Auth (OpenID Connect / PKCE), sessions stored in PostgreSQL
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, React Query, Wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── live-music-tracker/ # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Replit Auth web client hook
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

1. **Authentication** — Replit Auth (OIDC / PKCE). Sessions stored in `sessions` table.
2. **User preferences** — Each user can save cities and zip codes to filter shows.
3. **Venues (admin)** — Admins can add/edit/delete music venue websites. Venues can be scraped via the scraper.
4. **Web scraping** — `artifacts/api-server/src/lib/scraper.ts` fetches venue pages and extracts shows via JSON-LD structured data or HTML parsing. Admins trigger scrapes from the admin panel.
5. **Shows** — Shows are stored in the `shows` table. The list endpoint filters by user preferences automatically.
6. **Attendance** — Users can mark themselves as attending a show and toggle a "bought tickets" flag.
7. **Friends** — Users can send/accept/decline friend requests. Friends' attendance is surfaced on show cards and the Friends activity feed.
8. **CSV export** — `/api/export/shows` returns all shows as a downloadable CSV.

## Database Schema

- `sessions` — Replit Auth sessions
- `users` — Users (upserted on OIDC callback); has `username`, `is_admin`, `profile_image_url`
- `user_preferences` — Per-user cities/zip codes arrays
- `venues` — Music venues with `website_url`, `scrape_url`, `is_active`, `last_scraped_at`
- `shows` — Scraped/manual shows with date, time, ticket info, etc.
- `attendance` — User ↔ show relationship with `bought_tickets` flag
- `friends` — Bidirectional friendship records
- `friend_requests` — Friend request lifecycle (pending/accepted/declined)

## Admin Access

Set `is_admin = true` in the `users` table for any user to grant admin access:
```sql
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

## API Server Routes

All routes prefixed with `/api`.

- `GET /healthz` — health check
- `GET /auth/user` — current auth user
- `GET /login` — OIDC login redirect
- `GET /callback` — OIDC callback
- `GET /logout` — OIDC logout
- `GET /auth/me` — current user profile
- `GET /users/preferences` — get user's location preferences
- `PUT /users/preferences` — update preferences
- `GET /users/search?q=` — search users by username
- `GET /venues` — list venues
- `POST /venues` — create venue (admin)
- `GET /venues/:id` — get venue
- `PATCH /venues/:id` — update venue (admin)
- `DELETE /venues/:id` — delete venue (admin)
- `POST /venues/:id/scrape` — scrape venue (admin)
- `POST /venues/scrape-all` — scrape all active venues (admin)
- `GET /shows` — list shows (filtered by user prefs or query params)
- `GET /shows/:id` — get show with attendee details
- `POST /shows/:id/attend` — mark attending / update tickets bought
- `DELETE /shows/:id/attend` — remove attendance
- `GET /shows/:id/attendees` — list show attendees
- `GET /friends` — list friends
- `GET /friends/requests` — pending friend requests
- `POST /friends/requests` — send friend request
- `POST /friends/requests/:id/accept` — accept friend request
- `POST /friends/requests/:id/decline` — decline friend request
- `DELETE /friends/:id` — remove friend
- `GET /friends/activity` — friends' upcoming show attendance
- `GET /export/shows` — export shows as CSV

## TypeScript & Composite Projects

- `lib/*` packages are composite and emit declarations via `tsc --build`.
- `artifacts/*` are leaf packages checked with `tsc --noEmit`.
- Always typecheck from root: `pnpm run typecheck`

## Codegen

After spec changes, run:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## DB Push

```bash
pnpm --filter @workspace/db run push
# If column conflicts:
pnpm --filter @workspace/db run push-force
```
