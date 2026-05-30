import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { aiInsightsSchema, demandForecastGenerateSchema } from '../validators/schemas';
import { authMiddleware } from '../middleware/auth';
import { generateInsights, generateDemandForecast } from '../services/gemini';
import { db } from '../db';
import { demandTimeseries } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const aiRoutes = new Hono<{ Variables: { userId: string } }>();

aiRoutes.use('*', authMiddleware);

aiRoutes.post('/insights', zValidator('json', aiInsightsSchema), async (c) => {
  const { context, data } = c.req.valid('json');

  try {
    const insights = await generateInsights(context, data);
    return c.json({ insights, generatedAt: new Date().toISOString() });
  } catch (error) {
    return c.json({ error: 'Failed to generate insights', code: 'AI_ERROR', details: {} }, 500);
  }
});

// Since the README puts `/dashboard/demand-forecast/generate` under AI service conceptually,
// we can either put it here or in dashboard. Let's make an endpoint here and we will route
// the dashboard path to it or keep it consistent with the README.
// README: `POST /dashboard/demand-forecast/generate` uses Gemini.
// Let's create it here and we'll mount it accordingly or just mount it directly in index.ts
// Wait, to follow README perfectly:
// `POST /ai/insights` is here.
// `POST /dashboard/demand-forecast/generate` is under dashboard.
// I will just put the logic here, then export it, or I'll just add it to dashboard.ts.
// Let's modify `dashboard.ts` later to include it, or put it here and let `index.ts` route it properly.
// It's cleaner to put it here and mount `aiRoutes` on `/api/v1/ai`
// Wait, the README says: `POST /dashboard/demand-forecast/generate` Uses Gemini API
export const generateForecastRoute = new Hono<{ Variables: { userId: string } }>();
generateForecastRoute.post('/', authMiddleware, zValidator('json', demandForecastGenerateSchema), async (c) => {
  const { horizonDays } = c.req.valid('json');
  const userId = c.get('userId');

  try {
    const data = await db.select().from(demandTimeseries).where(eq(demandTimeseries.userId, userId)).orderBy(desc(demandTimeseries.recordDate)).limit(90);
    
    const historicalData = data.reverse().map(d => ({
      date: d.recordDate,
      demand: d.actualDemand
    }));

    const forecast = await generateDemandForecast(historicalData, horizonDays);
    
    // Insert into db (actualDemand = null)
    if (Array.isArray(forecast)) {
      const rows = forecast.map((f: any) => ({
        userId,
        recordDate: f.date,
        forecastDemand: String(f.forecastDemand),
      }));
      if (rows.length > 0) {
        await db.insert(demandTimeseries).values(rows);
      }
    }

    return c.json({ forecast, generatedAt: new Date().toISOString() });
  } catch (error) {
    return c.json({ error: 'Failed to generate forecast', code: 'AI_ERROR', details: {} }, 500);
  }
});

export default aiRoutes;
