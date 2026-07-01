# DataBox API: SME Intelligence & Demand Forecasting 🚀

The DataBox API is the backend engine powering Bizanolytics, an AI-driven SME intelligence dashboard. Built for speed and spatial intelligence, this architecture handles automated data imputation via CSV uploads, complex PostGIS spatial queries for global market forecasting, and seamless integration with the Groq API for predictive analytics and actionable business insights.

## 🧠 Core Architecture & Key Features

* **High-Performance Runtime:** Built on **Bun** and **Hono** for a blazingly fast, edge-ready API deployed on Vercel Serverless Functions.
* **Geospatial Intelligence:** Utilizes **Neon Postgres** with the **PostGIS** extension to calculate real-time global demand forecasting, rendering interactive heatmaps and proximity-based market leaderboards.
* **AI-Powered Demand Synthesis:** Integrates the **Groq API** to dynamically analyze historical time-series data, generate future demand horizons, and synthesize raw data into natural language business insights.
* **Automated Data Pipelines:** Features a robust CSV upload and parsing engine (powered by Papaparse) for handling sales, inventory, and expense data with automatic validation and skipped-row reporting.
* **Bulletproof Type Safety:** End-to-end type safety leveraging **TypeScript**, **Drizzle ORM** for database interactions, and **Zod** for stringent request validation.

---

## 🛠 Tech Stack & Setup

| Layer | Technology |
|---|---|
| **Runtime** | Bun |
| **Framework** | Hono |
| **ORM** | Drizzle ORM |
| **Database** | Neon Postgres (with PostGIS) |
| **Auth** | JWT (access + refresh tokens) |
| **AI / Forecasting** | Groq API |
| **Testing** | `bun:test` |
| **Hosting** | Vercel (Serverless Functions) |

### Vercel Deployment

This Hono app is deployed as Vercel Serverless Functions. All endpoints are standard HTTP REST (No Redis, No WebSockets).

**`vercel.json`**
```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/index" }]
}
```

**Entry point: `api/index.ts`**
```typescript
import { handle } from 'hono/vercel'
import app from '../src/index'

export const config = { runtime: 'edge' } 
export default handle(app)
```

---

## 🗄️ Database Schema

Requires the PostGIS extension: `CREATE EXTENSION IF NOT EXISTS postgis;`

### Core Tables

* **`users`**: Manages authentication (bcrypt password hashing, JWTs) and profiles.
* **`kpi_snapshots`**: Daily performance records (total revenue, active products, forecast accuracy, active users).
* **`demand_timeseries`**: Tracks actual vs. forecasted demand by day.
* **`channel_performance`**: Monthly revenue breakdown by channel (Online, Retail, Wholesale, Direct).
* **`performance_metrics`**: Multi-dimensional radar chart data comparing current vs. previous periods.
* **`regional_revenue`**: Geographic revenue distribution (North, South, East, West).
* **`data_pipeline_events`**: Logs data ingestion, transformation, and export statuses.
* **`raw_data`**: Stores unaggregated data points uploaded via CSV.

### Spatial Table: `market_forecasts`
Drives the global heatmap and top-markets leaderboard using PostGIS.
```sql
CREATE TABLE market_forecasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country           TEXT NOT NULL,
  region            TEXT NOT NULL,
  geom              GEOMETRY(Point, 4326),  -- PostGIS point (lon, lat)
  forecasted_demand NUMERIC(12, 2),
  current_stock     NUMERIC(12, 2),
  confidence        NUMERIC(5, 2),
  growth_rate       NUMERIC(6, 2),
  period            DATE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX market_forecasts_geom_idx ON market_forecasts USING GIST(geom);
```

---

## 📡 Detailed API Reference

Base URL: `https://<your-vercel-app>.vercel.app/api/v1`

All protected endpoints (`🔒`) require: `Authorization: Bearer <access_token>`

### 1. Authentication
* **`POST /auth/register`**: Accepts `name`, `email`, `password`. Returns user profile + JWTs.
* **`POST /auth/login`**: Authenticates user and returns JWTs.
* **`POST /auth/refresh`**: Accepts a refresh token and returns a new access token.
* **`GET /auth/me`** 🔒: Returns the authenticated user's profile.

### 2. Dashboard KPIs & Metrics
* **`GET /dashboard/kpis`** 🔒: Fetches aggregate snapshots based on `?period=30d`.
* **`GET /dashboard/channel-performance`** 🔒: Returns revenue distribution across sales channels for a specific month.
* **`GET /dashboard/performance-metrics`** 🔒: Radar chart data across dimensions (Sales, Marketing, Support, Logistics, Finance).
* **`GET /dashboard/regional-revenue`** 🔒: Revenue splits by geographic regions (North, South, East, West).

### 3. Demand Forecasting & AI Integrations
* **`GET /dashboard/demand-forecast`** 🔒: Time-series data of actual vs. predicted demand.
* **`POST /dashboard/demand-forecast/generate`** 🔒: Triggers the Groq API to analyze the last 90 days of `demand_timeseries` and generate a future forecast array.
* **`POST /ai/insights`** 🔒: Submits a specific dashboard data context to the Groq API, returning actionable, natural language insights.

### 4. PostGIS Spatial Markets
* **`GET /dashboard/market-forecasts`** 🔒: Fetches global forecast data, utilizing PostGIS to map longitudes and latitudes for frontend plotting. Supports regional filtering.
* **`GET /dashboard/market-forecasts/top`** 🔒: Ranks the most lucrative markets using `ST_DWithin` spatial proximity filters and growth indicators.

### 5. Data Pipeline & CSV Imputation
* **`GET /dashboard/raw-data`** 🔒: Paginated view of raw uploaded inputs. 
* **`GET /dashboard/raw-data/export`** 🔒: Triggers a direct CSV download of the raw data view.
* **`POST /api/v1/data/upload`** 🔒: Accepts `multipart/form-data`. Processes CSVs up to 5MB utilizing Papaparse. Automatically maps data based on the provided `type` parameter (`sales`, `inventory`, `demand`, or `expenses`), skipping and logging invalid rows without failing the entire batch.

---


## 🚀 Local Development & Testing

### Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:pass@host/db   # Neon Postgres connection string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
GROQ_API_KEY=AIza...
CORS_ORIGIN=https://ai-buildfest.netlify.app
```

### Installation & Database Seeding
```bash
bun install
bun run db:migrate  # Push Drizzle schema to Neon
bun run db:seed     # Populate demo user, 90-day time-series, and 29 PostGIS market coordinates
```

### Start Development Server
```bash
bun run dev
```

### Test Coverage (`bun:test`)
The architecture includes an extensive API integration test suite covering authentication flows, valid/invalid CSV uploads, PostGIS market filtering, and mocked Groq API responses.
```bash
bun test
```
