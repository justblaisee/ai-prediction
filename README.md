# Inventory Intelligence

[![Live Demo](https://img.shields.io/badge/Live-Demo-2ea44f?style=for-the-badge&logo=githubpages&logoColor=white)](https://justblaisee.github.io/ai-prediction/)
[![Deploy Web To GitHub Pages](https://img.shields.io/github/actions/workflow/status/justblaisee/ai-prediction/deploy-pages.yml?branch=master&style=for-the-badge&label=Pages%20Deploy)](https://github.com/justblaisee/ai-prediction/actions/workflows/deploy-pages.yml)

Inventory Intelligence is a full-stack SaaS application for inventory operations with demand forecasting, stockout alerts, and organization-level data isolation.

## Highlights

- Multi-tenant inventory platform with JWT auth and role-based access.
- AI prediction workflow with training trigger and live training status polling.
- Dashboard with KPI cards, category distribution, demand forecast, and alerts.
- End-to-end local deployment via Docker Compose.

## Tech Stack

- Frontend: Next.js 14, TypeScript, React Query, Tailwind CSS, Recharts, Framer Motion
- API: Express.js, TypeScript, Prisma, PostgreSQL, Redis
- ML Service: FastAPI, Prophet, XGBoost (with fallback forecasting path)
- Infra: Docker, Docker Compose

## Monorepo Structure

```text
apps/
  api/   # Express API + Prisma
  ml/    # FastAPI forecasting service
  web/   # Next.js frontend
```

## Quick Start (Docker)

### Prerequisites

- Docker Desktop
- Node.js 18+ (optional for local non-docker dev)
- pnpm 8+ (optional for local non-docker dev)

### Run

```bash
docker compose up -d --build
```

### Access

- Frontend: http://localhost:3001
- API: http://localhost:4000
- ML Service: http://localhost:8001

## Live Demo

- GitHub Pages (frontend): `https://justblaisee.github.io/ai-prediction/`
- Note: interactive features still require reachable API/ML endpoints.

### Default Account

- Email: `admin@startup.test`
- Password: `StartUp123!`
- Organization: `Acme Corp`

## Local Development (without Docker)

```bash
corepack enable
corepack pnpm install
```

```bash
# terminal 1
corepack pnpm --filter api dev

# terminal 2
corepack pnpm --filter ml dev

# terminal 3
corepack pnpm --filter web dev
```

## Useful Commands

```bash
# build all apps
corepack pnpm build

# seed default dataset
corepack pnpm --filter api db:seed

# add large demo dataset for portfolio screenshots
corepack pnpm --filter api exec tsx prisma/seed-1000-products.ts
```

## Portfolio Demo Flow

1. Login with default account.
2. Open `Products` to show inventory scale.
3. Open `Predictions`, pick a product, click `Train Model`.
4. Show live training status (`running/completed/failed`) and resulting forecast chart.
5. Open `Dashboard` and `Alerts` to explain business value.

## License

MIT
