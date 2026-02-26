# Inventory Intelligence - SaaS

A production-minded SaaS application for inventory management with AI-powered demand forecasting.

## Features

- **Dashboard**: Real-time KPI monitoring with interactive charts
- **Product Management**: Full CRUD operations for products
- **Demand Prediction**: ML-powered forecasting using Prophet + XGBoost
- **Alerts**: Automated stockout and low-stock notifications
- **Multi-tenant**: Organization-based data isolation
- **Authentication**: JWT-based auth with refresh tokens

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Framer Motion
- **Backend**: Express.js, TypeScript, Prisma, PostgreSQL, Redis
- **ML Service**: FastAPI, Prophet, XGBoost
- **Infrastructure**: Docker, Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Setup & Run

1. **Install dependencies**:
```
bash
pnpm install
```

2. **Start infrastructure**:
```
bash
docker-compose up -d postgres redis
```

3. **Setup database**:
```
bash
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev
pnpm db:seed
```

4. **Start all services**:
```
bash
# Terminal 1 - Backend
cd apps/api && pnpm dev

# Terminal 2 - ML Service
cd apps/ml && pnpm dev

# Terminal 3 - Frontend
cd apps/web && pnpm dev
```

Or use Docker:
```
bash
docker-compose up -d
```

### Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **ML Service**: http://localhost:8000

### Default Credentials

- **Email**: admin@startup.test
- **Password**: StartUp123!
- **Organization**: Acme Corp

## API Examples

### Login
```
bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@startup.test","password":"StartUp123!"}'
```

### Get Predictions
```
bash
curl -X GET "http://localhost:4000/api/predictions/product/PRODUCT_ID?days=90" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Products
```
bash
curl -X GET http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Project Structure

```
├── apps/
│   ├── api/          # Express.js backend
│   ├── ml/           # FastAPI ML service
│   └── web/          # Next.js frontend
├── packages/         # Shared packages
├── infra/            # Docker configs
├── docker-compose.yml
└── README.md
```

## License

MIT
