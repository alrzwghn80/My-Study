# Personal German Study OS

A private, single-user German-study tracking platform. See `docs/product-spec.md` for the product philosophy and page list, and the rest of `docs/` for the full architecture (database, timer state machine, analytics formulas, testing strategy).

## Stack

Next.js 16 (App Router) + TypeScript + PostgreSQL + Prisma 7 + NextAuth (credentials). See `docs/architecture.md` for the full rationale.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (a local Postgres — see below), `AUTH_SECRET`, and the seed user credentials.
3. `npx prisma migrate dev` — applies every migration in `prisma/migrations/`.
4. `npx prisma generate` — regenerates the client into `src/generated/prisma` (gitignored; runs automatically after `migrate dev`, listed here for when you only change the client version).
5. `npx tsx prisma/seed.ts` — creates the one user (from `SEED_USER_EMAIL`/`SEED_USER_PASSWORD`) and the default category taxonomy. Safe to re-run.
6. `npm run dev`, open http://localhost:3000, sign in with the seed credentials.

### Local Postgres

This project was developed against a locally installed Postgres 16 (`apt install postgresql`), not Docker — either works. Quick setup:

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE ROLE studyos LOGIN PASSWORD 'studyos' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE study_os OWNER studyos;"
```

(`CREATEDB` is required on the role because `prisma migrate dev` creates a disposable shadow database to detect drift.)

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build/serve
- `npm run lint` — ESLint
- `npm run test` — Vitest (unit + integration; integration tests need `DATABASE_URL_TEST` — see `.env.example` and `docs/testing.md`)
- `npx tsc --noEmit` — typecheck
- `npx prisma migrate dev --name <description>` — create + apply a migration after editing `prisma/schema.prisma`
- `npx prisma studio` — browse the database

### Manual browser QA scripts (`scripts/`)

Not part of the automated suite — small Playwright scripts used to verify the UI in a real browser during development, kept around for future manual QA:

- `node scripts/e2e-smoke.mjs` — logs in and walks the full timer flow (start → live countdown → pause → resume → complete → review → history), failing on any browser console error.
- `node scripts/screenshot.mjs <path> <width> <height> <outFile>` — logs in and saves a full-page screenshot of any route, e.g. `node scripts/screenshot.mjs /history 390 900 /tmp/history-mobile.png` for a quick responsive check.

Both require the dev server running on :3000 and Chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome` (adjust the `executablePath` in each script if your Playwright browser cache lives elsewhere — run `npx playwright install chromium` if you don't have one).

## Deployment (VPS)

This app targets a single-user self-hosted deployment (spec §35), not a PaaS. On a fresh VPS:

1. Install Node.js 22+, PostgreSQL 16+, and clone this repo.
2. `npm ci`, then `npx prisma migrate deploy` (applies migrations without the dev-only shadow-database drift check — no `CREATEDB` grant needed for this one).
3. Set a real `.env`: a production `DATABASE_URL`, a freshly generated `AUTH_SECRET` (`openssl rand -base64 32` — never reuse the one from development), and your own `SEED_USER_EMAIL`/`SEED_USER_PASSWORD`.
4. `npx tsx prisma/seed.ts` once, then **change the seed password** if you don't override it — the seed script hashes whatever `SEED_USER_PASSWORD` is at the time it runs.
5. `npm run build && npm run start` (or run `next start` under a process manager — systemd or pm2 — so it restarts on crash/reboot).
6. Put a reverse proxy (nginx or Caddy) in front of port 3000 for TLS. `trustHost: true` is already set in `src/server/auth.config.ts` for this exact setup (self-hosted behind your own proxy) — see the comment there before changing it, and only ever put this app behind a proxy you control.

No Docker setup is included — the app has no dependency that requires it (plain Node + Postgres), but containerizing is straightforward if preferred (a `Dockerfile` isn't provided since the deployment target and process-manager choice are yours to make).

## Repo layout

This app lives in `study-os/` alongside the unrelated `saman-academy/` static marketing site in the same repository — the two are independent projects sharing git history only, per the decision recorded when this project was started.
