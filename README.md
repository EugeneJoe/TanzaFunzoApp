# Tanza Fellowship Hub — Beta

Classroom-learning platform for Phase 1 of the Tanza Fellowship. Built against
[`implementation-plan.md`](./implementation-plan.md) — see that file plus its
companions ([`SRS-tanza-fellowship-hub-beta.md`](./SRS-tanza-fellowship-hub-beta.md),
[`data-model.md`](./data-model.md), [`build-plan.md`](./build-plan.md)) for the
full requirements, schema, and prioritisation rationale.

This is a stub — Stage 7 of the implementation plan replaces this with the full
setup/architecture/limitations writeup.

## Prerequisites

- Node.js 20.9+ (this repo was built against 20.19.4)
- A Postgres database (developed against [Neon](https://neon.tech))

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL at minimum
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `/api/health` should
return `{ "ok": true }` once `DATABASE_URL` points at a reachable database.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npx tsc --noEmit` | Typecheck |
| `npx drizzle-kit generate` | Generate a SQL migration from `src/db/schema.ts` |
| `npx drizzle-kit migrate` | Apply pending migrations |
