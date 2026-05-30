# DataBox — Backend API Specification

> **For: Antigravity (Backend Engineer)**
> **Stack: TypeScript · Bun · Hono · Drizzle ORM · Neon Postgres (PostGIS) · Gemini API**
> **Hosting: Vercel**
> **Frontend: [https://ai-buildfest.netlify.app/](https://ai-buildfest.netlify.app/)**

---

## 1. Project Overview

DataBox is an SME intelligence dashboard that provides:

- KPI overview cards (revenue, products, users, forecast accuracy)
- Demand forecasting with actual vs. predicted time-series charts
- Channel performance breakdown (pie/donut chart)
- Performance metrics radar (multi-dimensional, current vs. previous)
- Regional revenue distribution (North / South / East / West)
- Global demand forecast heatmap across 29 markets (PostGIS-powered)
- Top markets leaderboard with growth indicators
- Data pipeline event log tab
- Raw data table/export tab
- Per-user auth (JWT), with user profile display

The frontend is a **Next.js / React** app deployed on Netlify. All data is fetched from this backend. There is **no mock data** in production — every widget calls a real API endpoint.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Hono |
| ORM | Drizzle ORM |
| Database | Neon Postgres (with PostGIS extension) |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| AI / Forecasting | Google Gemini API (`gemini-1.5-flash` or `gemini-1.5-pro`) |
| Testing | Bun test (`bun:test`) |
| Hosting | Vercel (Serverless Functions) |

> ⚠️ **No Redis. No WebSockets.** All endpoints are standard HTTP REST. The frontend polls for updates where needed.

---

## 3. Vercel Deployment Setup

This is a **Hono app deployed as Vercel Serverless Functions**. Use the Hono Vercel adapter.

### `vercel.json`

```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/index" }]
}
```

### Entry point: `api/index.ts`

```typescript
import { handle } from 'hono/vercel'
import app from '../src/index'

export const config = { runtime: 'edge' }  // or 'nodejs20.x' if PostGIS queries need full Node
export default handle(app)
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "test": "bun test",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "bun run src/db/seed.ts"
  }
}
```

---

## 4. Database Schema

Enable the PostGIS extension first:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 4.1 `users`

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,           -- bcrypt hash
  avatar_url  TEXT,
  plan        TEXT DEFAULT 'free',     -- 'free' | 'pro'
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 `kpi_snapshots`

One row per day per user. Drives the four top KPI cards.

```sql
CREATE TABLE kpi_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id),
  snapshot_date     DATE NOT NULL,
  total_revenue     NUMERIC(12, 2),
  active_products   INT,
  forecast_accuracy NUMERIC(5, 2),   -- e.g. 94.20
  active_users      INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 `demand_timeseries`

Actual vs. forecasted demand by day.

```sql
CREATE TABLE demand_timeseries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  record_date     DATE NOT NULL,
  actual_demand   NUMERIC(12, 2),
  forecast_demand NUMERIC(12, 2),
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 `channel_performance`

```sql
CREATE TABLE channel_performance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  period      DATE NOT NULL,          -- month start date
  channel     TEXT NOT NULL,         -- 'Online' | 'Retail' | 'Wholesale' | 'Direct'
  revenue     NUMERIC(12, 2),
  percentage  NUMERIC(5, 2)
);
```

### 4.5 `performance_metrics`

Radar chart data — multi-dimensional scores per period.

```sql
CREATE TABLE performance_metrics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  period      TEXT NOT NULL,          -- 'current' | 'previous'
  dimension   TEXT NOT NULL,         -- 'Sales' | 'Marketing' | 'Support' | 'Logistics' | 'Finance'
  value       NUMERIC(5, 2)          -- 0-100 score
);
```

### 4.6 `regional_revenue`

```sql
CREATE TABLE regional_revenue (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  period      DATE NOT NULL,
  region      TEXT NOT NULL,         -- 'North' | 'South' | 'East' | 'West'
  revenue     NUMERIC(12, 2),
  percentage  NUMERIC(5, 2)
);
```

### 4.7 `market_forecasts` (PostGIS)

One row per market (country). Drives the global heatmap and top-markets leaderboard.

```sql
CREATE TABLE market_forecasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country           TEXT NOT NULL,
  region            TEXT NOT NULL,    -- 'North America' | 'Europe' | 'Asia Pacific' | 'South America' | 'Middle East & Africa'
  geom              GEOMETRY(Point, 4326),  -- PostGIS point (lon, lat)
  forecasted_demand NUMERIC(12, 2),
  current_stock     NUMERIC(12, 2),
  confidence        NUMERIC(5, 2),   -- percentage
  growth_rate       NUMERIC(6, 2),   -- percentage, can be negative
  period            DATE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX market_forecasts_geom_idx ON market_forecasts USING GIST(geom);
```

### 4.8 `data_pipeline_events`

For the "Data Pipeline" tab.

```sql
CREATE TABLE data_pipeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  event_type    TEXT NOT NULL,        -- 'ingestion' | 'transform' | 'export' | 'error'
  source        TEXT,
  status        TEXT NOT NULL,       -- 'running' | 'success' | 'failed'
  rows_affected INT,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 4.9 `raw_data`

```sql
CREATE TABLE raw_data (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  source      TEXT,
  category    TEXT,
  value       NUMERIC(12, 2),
  metadata    JSONB,
  record_date DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. API Endpoints

Base URL: `https://<your-vercel-app>.vercel.app/api/v1`

All protected endpoints `🔒` require:

```
Authorization: Bearer <access_token>
```

---

### 5.1 Auth

#### `POST /auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@databox.io",
  "password": "StrongPass123!"
}
```

**Response `201`:**
```json
{
  "user": { "id": "uuid", "name": "John Doe", "email": "john@databox.io", "plan": "free" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

#### `POST /auth/login`

**Request:**
```json
{ "email": "john@databox.io", "password": "StrongPass123!" }
```

**Response `200`:**
```json
{
  "user": { "id": "uuid", "name": "John Doe", "email": "john@databox.io", "plan": "free", "avatarUrl": null },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

#### `POST /auth/refresh`

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Response `200`:**
```json
{ "accessToken": "eyJ..." }
```

---

#### `GET /auth/me` 🔒

**Response `200`:**
```json
{ "id": "uuid", "name": "John Doe", "email": "john@databox.io", "plan": "free", "avatarUrl": null }
```

---

### 5.2 KPI Snapshots

#### `GET /dashboard/kpis` 🔒

Query params: `?period=30d` (supports `7d`, `30d`, `90d`)

**Response `200`:**
```json
{
  "totalRevenue":     { "value": 284521.00, "change": 12.5,  "changeLabel": "vs last month" },
  "activeProducts":   { "value": 1847,      "change": 4.2,   "changeLabel": "new this month" },
  "forecastAccuracy": { "value": 94.2,      "change": 2.1,   "changeLabel": "improvement" },
  "activeUsers":      { "value": 12489,     "change": -1.8,  "changeLabel": "vs last week" }
}
```

---

### 5.3 Demand Forecast

#### `GET /dashboard/demand-forecast` 🔒

Query params: `?period=30d`

**Response `200`:**
```json
{
  "data": [
    { "date": "2025-01-01", "actualDemand": 4200, "forecastDemand": 4050 },
    { "date": "2025-01-02", "actualDemand": 4350, "forecastDemand": 4300 }
  ]
}
```

---

#### `POST /dashboard/demand-forecast/generate` 🔒

Uses Gemini API to generate a demand forecast from the user's historical data.

**Request:**
```json
{ "horizonDays": 30, "includeSeasonality": true }
```

**Backend behaviour:**
1. Pull last 90 days of `demand_timeseries` for the authenticated user
2. Send to Gemini with a structured forecasting prompt (see Section 7)
3. Parse JSON response from Gemini
4. Insert forecast rows into `demand_timeseries` (with `actual_demand = null`)
5. Return the generated forecast

**Response `200`:**
```json
{
  "forecast": [
    { "date": "2025-02-01", "forecastDemand": 4600, "confidence": 0.91 }
  ],
  "generatedAt": "2025-01-31T10:00:00Z"
}
```

---

### 5.4 Channel Performance

#### `GET /dashboard/channel-performance` 🔒

Query params: `?period=2025-01` (YYYY-MM)

**Response `200`:**
```json
{
  "channels": [
    { "channel": "Online",    "revenue": 98450, "percentage": 34.6 },
    { "channel": "Retail",    "revenue": 76200, "percentage": 26.8 },
    { "channel": "Wholesale", "revenue": 62800, "percentage": 22.1 },
    { "channel": "Direct",    "revenue": 47071, "percentage": 16.5 }
  ]
}
```

---

### 5.5 Performance Metrics (Radar)

#### `GET /dashboard/performance-metrics` 🔒

**Response `200`:**
```json
{
  "dimensions": ["Sales", "Marketing", "Support", "Logistics", "Finance"],
  "current":  [88, 72, 95, 80, 85],
  "previous": [75, 68, 90, 74, 80]
}
```

---

### 5.6 Regional Revenue

#### `GET /dashboard/regional-revenue` 🔒

Query params: `?period=2025-01`

**Response `200`:**
```json
{
  "regions": [
    { "region": "North", "revenue": 35200, "percentage": 26 },
    { "region": "South", "revenue": 28400, "percentage": 21 },
    { "region": "East",  "revenue": 42800, "percentage": 31 },
    { "region": "West",  "revenue": 31200, "percentage": 23 }
  ]
}
```

---

### 5.7 Market Forecasts (Global Heatmap — PostGIS)

#### `GET /dashboard/market-forecasts` 🔒

Query params:
- `?region=all` — one of `all | North America | Europe | Asia Pacific | South America | Middle East & Africa`
- `?period=2025-01`

**Response `200`:**
```json
{
  "summary": {
    "totalDemand": 462000,
    "totalStock": 441000,
    "avgConfidence": 88,
    "avgGrowth": 12.3
  },
  "markets": [
    {
      "country": "China",
      "region": "Asia Pacific",
      "lat": 35.8617,
      "lon": 104.1954,
      "forecastedDemand": 62000,
      "currentStock": 58000,
      "confidence": 91,
      "growthRate": 18.7
    }
  ]
}
```

**PostGIS query pattern:**

```sql
-- Basic region filter
SELECT country, region,
       ST_Y(geom) AS lat, ST_X(geom) AS lon,
       forecasted_demand, current_stock, confidence, growth_rate
FROM market_forecasts
WHERE period = $1
  AND ($2 = 'all' OR region = $2)
ORDER BY forecasted_demand DESC;

-- Proximity filter (optional — markets within N km of a point)
WHERE ST_DWithin(
  geom::geography,
  ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography,
  1000000  -- metres
)
```

---

#### `GET /dashboard/market-forecasts/top` 🔒

Query params: `?limit=10&region=all`

**Response `200`:**
```json
{
  "markets": [
    { "rank": 1, "country": "China",         "region": "Asia Pacific",   "forecastedDemand": 62000, "growthRate": 18.7 },
    { "rank": 2, "country": "United States", "region": "North America",  "forecastedDemand": 48500, "growthRate": 12.4 }
  ]
}
```

---

### 5.8 Data Pipeline

#### `GET /dashboard/pipeline/events` 🔒

Query params: `?limit=50&status=all`

**Response `200`:**
```json
{
  "events": [
    {
      "id": "uuid",
      "eventType": "ingestion",
      "source": "Shopify",
      "status": "success",
      "rowsAffected": 1240,
      "message": "Ingested 1240 orders",
      "createdAt": "2025-01-31T09:45:00Z"
    }
  ]
}
```

---

#### `POST /dashboard/pipeline/trigger` 🔒

**Request:**
```json
{ "source": "Shopify" }
```

**Response `202`:**
```json
{ "jobId": "uuid", "status": "running", "message": "Ingestion started" }
```

---

### 5.9 Raw Data

#### `GET /dashboard/raw-data` 🔒

Query params: `?page=1&limit=50&category=&source=&dateFrom=&dateTo=`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "source": "Shopify",
      "category": "Orders",
      "value": 1240.50,
      "metadata": { "orderId": "ORD-001" },
      "recordDate": "2025-01-15"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 3200, "totalPages": 64 }
}
```

---

#### `GET /dashboard/raw-data/export` 🔒

Returns a CSV download. Same query params as above.

**Response:** `Content-Type: text/csv`, `Content-Disposition: attachment; filename="raw-data.csv"`

---

### 5.10 AI Insights (Gemini-powered)

#### `POST /ai/insights` 🔒

Sends the user's current dashboard snapshot to Gemini and returns bullet-point insights.

**Request:**
```json
{
  "context": "kpis",
  "data": { /* any dashboard data object */ }
}
```

**Response `200`:**
```json
{
  "insights": [
    "Revenue grew 12.5% this month, driven largely by East region sales.",
    "Forecast accuracy improved to 94.2% — consider adjusting safety stock downward.",
    "Active user count dipped 1.8% week-over-week; monitor for churn signals."
  ],
  "generatedAt": "2025-01-31T10:00:00Z"
}
```

---

### 5.11 Notifications

#### `GET /notifications` 🔒

**Response `200`:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "alert",
      "message": "Forecast accuracy dropped below 90% for Asia Pacific",
      "read": false,
      "createdAt": "2025-01-31T08:00:00Z"
    }
  ],
  "unreadCount": 3
}
```

#### `PATCH /notifications/:id/read` 🔒

Marks a notification as read. Returns `200 { "success": true }`.

---

## 6. Authentication Middleware

```typescript
// src/middleware/auth.ts
import { verify } from 'hono/jwt'
import type { MiddlewareHandler } from 'hono'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized', code: 'MISSING_TOKEN' }, 401)
  try {
    const payload = await verify(token, process.env.JWT_SECRET!)
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, 401)
  }
}
```

---

## 7. Gemini API Integration

Use `@google/generative-ai` SDK.

```typescript
// src/services/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function generateDemandForecast(historicalData: DemandRow[], horizonDays: number) {
  const prompt = `
You are a demand forecasting model for an SME dashboard.
Given the following historical daily demand data (JSON array), generate a ${horizonDays}-day forecast.
Return ONLY a valid JSON array with no markdown, no explanation. Each element must have:
{ "date": "YYYY-MM-DD", "forecastDemand": number, "confidence": number (0-1) }

Historical data:
${JSON.stringify(historicalData)}
  `
  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json|```/g, '').trim()
  return JSON.parse(text)
}

export async function generateInsights(context: string, data: object) {
  const prompt = `
You are a business intelligence assistant for an SME dashboard.
Analyse the following ${context} data and return 3-5 concise, actionable insights.
Return ONLY a valid JSON array of strings, no markdown, no explanation.

Data:
${JSON.stringify(data)}
  `
  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json|```/g, '').trim()
  return JSON.parse(text) as string[]
}
```

---

## 8. Error Response Format

All errors must follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "SNAKE_CASE_CODE",
  "details": {}
}
```

Common HTTP codes: `400` validation, `401` unauthorized, `403` forbidden, `404` not found, `500` internal.

---

## 9. Environment Variables

```env
# .env.example
DATABASE_URL=postgresql://user:pass@host/db   # Neon Postgres connection string
JWT_SECRET=your_jwt_secret_32chars_min
JWT_REFRESH_SECRET=your_refresh_secret_32chars_min
GEMINI_API_KEY=AIza...
CORS_ORIGIN=https://ai-buildfest.netlify.app
```

Set all of these in the Vercel dashboard under **Project → Settings → Environment Variables**.

---

## 10. Project Structure

```
/
├── api/
│   └── index.ts              # Vercel entry point (Hono adapter)
├── src/
│   ├── index.ts              # Hono app, route registration, CORS
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema (all tables)
│   │   ├── index.ts          # Neon + Drizzle client
│   │   └── seed.ts           # Seed script
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── dashboard.ts      # kpis, demand, channel, metrics, regional
│   │   ├── markets.ts        # PostGIS market forecast routes
│   │   ├── pipeline.ts
│   │   ├── rawData.ts
│   │   ├── ai.ts
│   │   └── notifications.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── services/
│   │   └── gemini.ts         # Gemini API wrapper
│   └── validators/
│       └── schemas.ts        # Zod schemas for all request bodies
├── tests/
│   ├── auth.test.ts
│   ├── dashboard.test.ts
│   ├── markets.test.ts
│   ├── ai.test.ts
│   └── helpers.ts            # Shared test helpers (create test user, get token, etc.)
├── drizzle/
│   └── migrations/
├── drizzle.config.ts
├── vercel.json
├── package.json
└── .env.example
```

---

## 11. Test Cases

Use **`bun:test`** (built-in, no extra dependencies). Run with `bun test`.

Write tests in `tests/`. Each test file should spin up the Hono app in memory and make HTTP requests against it using `app.request()`.

### Test helpers (`tests/helpers.ts`)

```typescript
import app from '../src/index'

export async function registerAndLogin(email = 'test@test.com', password = 'Pass1234!') {
  await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password }),
  })
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  return body.accessToken as string
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}
```

---

### `tests/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'bun:test'
import app from '../src/index'

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@test.com', password: 'Pass1234!' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.accessToken).toBeDefined()
    expect(body.user.email).toBe('alice@test.com')
  })

  it('returns 400 for duplicate email', async () => {
    // Register same email twice
    const payload = JSON.stringify({ name: 'Bob', email: 'bob@test.com', password: 'Pass1234!' })
    await app.request('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    const res = await app.request('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', email: 'not-an-email', password: 'Pass1234!' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.com', password: 'Pass1234!' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accessToken).toBeDefined()
    expect(body.refreshToken).toBeDefined()
  })

  it('returns 401 for wrong password', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.com', password: 'wrongpass' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /auth/me', () => {
  it('returns user profile with valid token', async () => {
    const { registerAndLogin } = await import('./helpers')
    const token = await registerAndLogin('me@test.com', 'Pass1234!')
    const res = await app.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('me@test.com')
  })

  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })
})
```

---

### `tests/dashboard.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'bun:test'
import app from '../src/index'
import { registerAndLogin, authHeader } from './helpers'

let token: string
beforeAll(async () => { token = await registerAndLogin('dash@test.com', 'Pass1234!') })

describe('GET /dashboard/kpis', () => {
  it('returns all four KPI fields', async () => {
    const res = await app.request('/api/v1/dashboard/kpis?period=30d', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalRevenue).toBeDefined()
    expect(body.activeProducts).toBeDefined()
    expect(body.forecastAccuracy).toBeDefined()
    expect(body.activeUsers).toBeDefined()
  })

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/dashboard/kpis')
    expect(res.status).toBe(401)
  })

  it('rejects invalid period param', async () => {
    const res = await app.request('/api/v1/dashboard/kpis?period=999x', { headers: authHeader(token) })
    expect(res.status).toBe(400)
  })
})

describe('GET /dashboard/demand-forecast', () => {
  it('returns array of date/actual/forecast objects', async () => {
    const res = await app.request('/api/v1/dashboard/demand-forecast?period=30d', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe('GET /dashboard/channel-performance', () => {
  it('returns channels array', async () => {
    const res = await app.request('/api/v1/dashboard/channel-performance?period=2025-01', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.channels)).toBe(true)
  })
})

describe('GET /dashboard/regional-revenue', () => {
  it('returns four regions', async () => {
    const res = await app.request('/api/v1/dashboard/regional-revenue?period=2025-01', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.regions.length).toBe(4)
  })
})

describe('GET /dashboard/performance-metrics', () => {
  it('returns current and previous arrays of equal length', async () => {
    const res = await app.request('/api/v1/dashboard/performance-metrics', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.current.length).toBe(body.previous.length)
  })
})
```

---

### `tests/markets.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'bun:test'
import app from '../src/index'
import { registerAndLogin, authHeader } from './helpers'

let token: string
beforeAll(async () => { token = await registerAndLogin('markets@test.com', 'Pass1234!') })

describe('GET /dashboard/market-forecasts', () => {
  it('returns summary and markets array', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts?region=all&period=2025-01', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toBeDefined()
    expect(Array.isArray(body.markets)).toBe(true)
  })

  it('filters by region', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts?region=Europe&period=2025-01', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    body.markets.forEach((m: any) => expect(m.region).toBe('Europe'))
  })

  it('each market has lat and lon', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts?region=all&period=2025-01', { headers: authHeader(token) })
    const body = await res.json()
    body.markets.forEach((m: any) => {
      expect(typeof m.lat).toBe('number')
      expect(typeof m.lon).toBe('number')
    })
  })
})

describe('GET /dashboard/market-forecasts/top', () => {
  it('returns markets sorted by demand descending', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts/top?limit=5', { headers: authHeader(token) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.markets.length).toBeLessThanOrEqual(5)
    for (let i = 1; i < body.markets.length; i++) {
      expect(body.markets[i - 1].forecastedDemand).toBeGreaterThanOrEqual(body.markets[i].forecastedDemand)
    }
  })
})
```

---

### `tests/ai.test.ts`

```typescript
import { describe, it, expect, beforeAll, mock } from 'bun:test'
import app from '../src/index'
import { registerAndLogin, authHeader } from './helpers'

let token: string
beforeAll(async () => { token = await registerAndLogin('ai@test.com', 'Pass1234!') })

// Mock Gemini so tests don't make real API calls
mock.module('../src/services/gemini', () => ({
  generateInsights: async () => ['Insight 1', 'Insight 2', 'Insight 3'],
  generateDemandForecast: async () => [
    { date: '2025-02-01', forecastDemand: 4600, confidence: 0.91 },
  ],
}))

describe('POST /ai/insights', () => {
  it('returns an array of insight strings', async () => {
    const res = await app.request('/api/v1/ai/insights', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'kpis', data: { totalRevenue: 284521 } }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.insights)).toBe(true)
    expect(body.insights.length).toBeGreaterThan(0)
  })

  it('returns 400 if context is missing', async () => {
    const res = await app.request('/api/v1/ai/insights', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /dashboard/demand-forecast/generate', () => {
  it('returns forecast array', async () => {
    const res = await app.request('/api/v1/dashboard/demand-forecast/generate', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ horizonDays: 7, includeSeasonality: false }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.forecast)).toBe(true)
  })
})
```

---

## 12. Seed Data

Provide `src/db/seed.ts`. Run with `bun run db:seed`.

Populate:
- 1 demo user: `{ email: "john@databox.io", password: "demo1234", name: "John Doe" }`
- 90 days of `demand_timeseries`
- 1 `kpi_snapshots` row for today
- `channel_performance` for last 3 months
- `performance_metrics` for `current` + `previous` period
- `regional_revenue` for last 3 months
- All 29 `market_forecasts` rows with PostGIS point geometries

**All 29 markets:**

| Country | Region | Lat | Lon |
|---|---|---|---|
| China | Asia Pacific | 35.86 | 104.19 |
| United States | North America | 37.09 | -95.71 |
| India | Asia Pacific | 20.59 | 78.96 |
| Japan | Asia Pacific | 36.20 | 138.25 |
| Germany | Europe | 51.16 | 10.45 |
| Brazil | South America | -14.23 | -51.92 |
| United Kingdom | Europe | 55.37 | -3.43 |
| France | Europe | 46.22 | 2.21 |
| South Korea | Asia Pacific | 35.90 | 127.76 |
| Canada | North America | 56.13 | -106.34 |
| Australia | Asia Pacific | -25.27 | 133.77 |
| Mexico | North America | 23.63 | -102.55 |
| Indonesia | Asia Pacific | -0.78 | 113.92 |
| Saudi Arabia | Middle East & Africa | 23.88 | 45.07 |
| UAE | Middle East & Africa | 23.42 | 53.84 |
| South Africa | Middle East & Africa | -30.56 | 22.93 |
| Nigeria | Middle East & Africa | 9.08 | 8.67 |
| Egypt | Middle East & Africa | 26.82 | 30.80 |
| Argentina | South America | -38.41 | -63.61 |
| Colombia | South America | 4.57 | -74.29 |
| Chile | South America | -35.67 | -71.54 |
| Spain | Europe | 40.46 | -3.74 |
| Italy | Europe | 41.87 | 12.56 |
| Netherlands | Europe | 52.13 | 5.29 |
| Sweden | Europe | 60.12 | 18.64 |
| Poland | Europe | 51.91 | 19.14 |
| Vietnam | Asia Pacific | 14.05 | 108.27 |
| Thailand | Asia Pacific | 15.87 | 100.99 |
| Philippines | Asia Pacific | 12.87 | 121.77 |

---

## 13. CORS

```typescript
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'https://ai-buildfest.netlify.app',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))
```

---

## 14. CSV Upload

SMEs can upload business data as CSV files. The backend parses the file, maps columns to the correct table, and inserts rows into the database.

### New endpoint

#### `POST /api/v1/data/upload` 🔒

Accepts a `multipart/form-data` request with a CSV file and a `type` field indicating what kind of data is being uploaded.

**Request (multipart/form-data):**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File (.csv) | ✅ | The CSV file to upload |
| `type` | string | ✅ | One of `sales`, `inventory`, `demand`, `expenses` |

**Example curl:**
```bash
curl -X POST https://<app>.vercel.app/api/v1/data/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@sales_jan.csv" \
  -F "type=sales"
```

**Response `200`:**
```json
{
  "message": "Upload successful",
  "type": "sales",
  "rowsInserted": 240,
  "rowsSkipped": 3,
  "skippedReasons": ["Row 14: missing date", "Row 87: invalid value"]
}
```

**Error `400`:**
```json
{
  "error": "Invalid CSV format",
  "code": "CSV_PARSE_ERROR",
  "details": { "line": 5, "reason": "Expected 6 columns, got 4" }
}
```

---

### CSV format per type

#### `type=sales` → inserts into `raw_data`

```csv
date,source,category,value
2025-01-01,Shopify,Orders,1240.50
2025-01-02,Shopify,Orders,980.00
```

| Column | Maps to | Required |
|---|---|---|
| `date` | `record_date` | ✅ |
| `source` | `source` | ✅ |
| `category` | `category` | ✅ |
| `value` | `value` | ✅ |

---

#### `type=demand` → inserts into `demand_timeseries`

```csv
date,actual_demand,forecast_demand
2025-01-01,4200,4050
2025-01-02,4350,
```

| Column | Maps to | Notes |
|---|---|---|
| `date` | `record_date` | ✅ Required |
| `actual_demand` | `actual_demand` | ✅ Required |
| `forecast_demand` | `forecast_demand` | Optional, leave blank if unknown |

---

#### `type=inventory` → inserts into `raw_data` with `category = 'Inventory'`

```csv
date,source,product,quantity,value
2025-01-01,Warehouse A,SKU-001,500,12500.00
```

| Column | Maps to | Notes |
|---|---|---|
| `date` | `record_date` | ✅ |
| `source` | `source` | ✅ |
| `product` | `metadata.product` (JSONB) | ✅ |
| `quantity` | `metadata.quantity` (JSONB) | ✅ |
| `value` | `value` | ✅ |

---

#### `type=expenses` → inserts into `raw_data` with `category = 'Expenses'`

```csv
date,source,description,amount
2025-01-05,Operations,Office Rent,2500.00
```

| Column | Maps to | Notes |
|---|---|---|
| `date` | `record_date` | ✅ |
| `source` | `source` | ✅ |
| `description` | `metadata.description` (JSONB) | ✅ |
| `amount` | `value` | ✅ |

---

### Parsing logic (`src/services/csvParser.ts`)

Use the `papaparse` npm package (works in Bun).

```typescript
import Papa from 'papaparse'

export function parseCSV(fileText: string) {
  const result = Papa.parse(fileText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })
  return { data: result.data, errors: result.errors }
}
```

**Validation rules (apply to every row before insert):**
- `date` must be a valid `YYYY-MM-DD` string
- `value` / `amount` / `actual_demand` must be a finite number
- Skip and log any row that fails validation instead of aborting the whole upload
- Return the count of skipped rows and reasons in the response

---

### File size limit

Reject files over **5MB** with `413 Payload Too Large`:

```typescript
if (file.size > 5 * 1024 * 1024) {
  return c.json({ error: 'File too large. Maximum size is 5MB.', code: 'FILE_TOO_LARGE' }, 413)
}
```

---

### Test cases (`tests/upload.test.ts`)

```typescript
import { describe, it, expect, beforeAll } from 'bun:test'
import app from '../src/index'
import { registerAndLogin, authHeader } from './helpers'

let token: string
beforeAll(async () => { token = await registerAndLogin('upload@test.com', 'Pass1234!') })

const makeFormData = (csvContent: string, type: string) => {
  const form = new FormData()
  form.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test.csv')
  form.append('type', type)
  return form
}

describe('POST /data/upload', () => {
  it('uploads a valid sales CSV and returns rowsInserted', async () => {
    const csv = `date,source,category,value\n2025-01-01,Shopify,Orders,1200\n2025-01-02,Shopify,Orders,950`
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'sales'),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rowsInserted).toBe(2)
  })

  it('uploads a valid demand CSV', async () => {
    const csv = `date,actual_demand,forecast_demand\n2025-01-01,4200,4050\n2025-01-02,4350,4300`
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'demand'),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rowsInserted).toBe(2)
  })

  it('skips invalid rows and reports them', async () => {
    const csv = `date,source,category,value\n2025-01-01,Shopify,Orders,1200\nnot-a-date,Shopify,Orders,950`
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'sales'),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rowsInserted).toBe(1)
    expect(body.rowsSkipped).toBe(1)
  })

  it('returns 400 for unknown type', async () => {
    const csv = `date,value\n2025-01-01,100`
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'unknown_type'),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const csv = `date,source,category,value\n2025-01-01,Shopify,Orders,1200`
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      body: makeFormData(csv, 'sales'),
    })
    expect(res.status).toBe(401)
  })

  it('returns 413 for file over 5MB', async () => {
    const bigCSV = 'date,source,category,value\n' + '2025-01-01,Shopify,Orders,100\n'.repeat(300000)
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(bigCSV, 'sales'),
    })
    expect(res.status).toBe(413)
  })
})
```

---

## 15. Deployment Checklist (Vercel)

- [ ] Push repo to GitHub
- [ ] Import project in Vercel dashboard
- [ ] Set all env vars from `.env.example` in Vercel → Settings → Environment Variables
- [ ] Add `vercel.json` rewrite rule (Section 3)
- [ ] Run `bun run db:migrate` locally against Neon to apply migrations
- [ ] Run `bun run db:seed` once against Neon to populate demo data
- [ ] Set `NEXT_PUBLIC_API_URL=https://<your-app>.vercel.app/api/v1` in the **frontend's** Netlify env vars
