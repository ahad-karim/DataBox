import { Hono } from 'hono';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { marketForecasts } from '../db/schema';

const marketsRoutes = new Hono();

marketsRoutes.use('*', authMiddleware);

const marketsQuerySchema = z.object({
  region: z.string().optional().default('all'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid period').optional().default('2025-01'),
});

marketsRoutes.get('/', zValidator('query', marketsQuerySchema), async (c) => {
  const { region, period } = c.req.valid('query');
  
  // Create a raw query with Drizzle since we need ST_X and ST_Y
  const query = sql`
    SELECT country, region,
           ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lon,
           forecasted_demand, current_stock, confidence, growth_rate
    FROM market_forecasts
    WHERE (${region} = 'all' OR region = ${region})
  `;

  // Note: For Drizzle Neon HTTP we use db.execute
  const result = await db.execute(query);
  const rows = result.rows;

  let totalDemand = 0;
  let totalStock = 0;
  let totalConfidence = 0;
  let totalGrowth = 0;

  const markets = rows.map((r: any) => {
    const demand = Number(r.forecasted_demand);
    const stock = Number(r.current_stock);
    const conf = Number(r.confidence);
    const growth = Number(r.growth_rate);

    totalDemand += demand;
    totalStock += stock;
    totalConfidence += conf;
    totalGrowth += growth;

    return {
      country: r.country,
      region: r.region,
      lat: Number(r.lat),
      lon: Number(r.lon),
      forecastedDemand: demand,
      currentStock: stock,
      confidence: conf,
      growthRate: growth,
    };
  });

  const count = markets.length || 1;
  return c.json({
    summary: {
      totalDemand,
      totalStock,
      avgConfidence: Number((totalConfidence / count).toFixed(2)),
      avgGrowth: Number((totalGrowth / count).toFixed(2)),
    },
    markets,
  });
});

const topMarketsQuerySchema = z.object({
  limit: z.string().transform(Number).optional().default(10),
  region: z.string().optional().default('all'),
});

marketsRoutes.get('/top', zValidator('query', topMarketsQuerySchema), async (c) => {
  const { limit, region } = c.req.valid('query');

  const query = sql`
    SELECT country, region, forecasted_demand, growth_rate
    FROM market_forecasts
    WHERE (${region} = 'all' OR region = ${region})
    ORDER BY forecasted_demand DESC
    LIMIT ${limit}
  `;

  const result = await db.execute(query);
  const markets = result.rows.map((r: any, i: number) => ({
    rank: i + 1,
    country: r.country,
    region: r.region,
    forecastedDemand: Number(r.forecasted_demand),
    growthRate: Number(r.growth_rate)
  }));

  return c.json({ markets });
});

export default marketsRoutes;
