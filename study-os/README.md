# Personal German Study OS

A private, single-user German-study tracking platform. See `docs/product-spec.md` for the product philosophy and page list, and the rest of `docs/` for the full architecture (database, timer state machine, analytics formulas, testing strategy).

## Stack

Next.js 16 (App Router) + TypeScript + PostgreSQL + Prisma 7 + NextAuth (credentials). See `docs/architecture.md` for the full rationale.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (a local Postgres — see below), `AUTH_SECRET`, and the seed user credentials.
3. `npx prisma migrate dev` — applies every migration in `prisma/migrations/`.
4. `npx prisma generate` — regenerates the client into `src/generated/prisma` (gitignored; runs automatically after `migrate dev`, listed here for when you only change the client version).
5. `npm run dev`, open http://localhost:3000.

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
- `npx tsc --noEmit` — typecheck
- `npx prisma migrate dev --name <description>` — create + apply a migration after editing `prisma/schema.prisma`
- `npx prisma studio` — browse the database

## Repo layout

This app lives in `study-os/` alongside the unrelated `saman-academy/` static marketing site in the same repository — the two are independent projects sharing git history only, per the decision recorded when this project was started.
