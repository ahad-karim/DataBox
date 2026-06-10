import { Hono } from 'hono';
import { db } from '../db';
import { kpiSnapshots, demandTimeseries, channelPerformance, performanceMetrics, regionalRevenue, salesFacts } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { periodQuerySchema } from '../validators/schemas';
import { z } from 'zod';

const dashboardRoutes = new Hono<{ Variables: { userId: string } }>();

dashboardRoutes.use('*', authMiddleware);

dashboardRoutes.get('/kpis', zValidator('query', periodQuerySchema), async (c) => {
  const userId = c.get('userId');
  const userSales = await db.select().from(salesFacts).where(eq(salesFacts.userId, userId));

  if (userSales.length === 0) {
    const [kpi] = await db.select().from(kpiSnapshots).where(eq(kpiSnapshots.userId, userId)).orderBy(desc(kpiSnapshots.snapshotDate)).limit(1);

    if (!kpi) {
      return c.json({ totalRevenue: {}, activeProducts: {}, forecastAccuracy: {}, activeUsers: {} });
    }

    return c.json({
      totalRevenue: { value: Number(kpi.totalRevenue), change: 12.5, changeLabel: 'vs last month' },
      activeProducts: { value: kpi.activeProducts, change: 4.2, changeLabel: 'new this month' },
      forecastAccuracy: { value: Number(kpi.forecastAccuracy), change: 2.1, changeLabel: 'improvement' },
      activeUsers: { value: kpi.activeUsers, change: -1.8, changeLabel: 'vs last week' },
    });
  }

  const totalRevenue = userSales.reduce((acc, s) => acc + Number(s.revenueBdt), 0);
  const activeProducts = new Set(userSales.map(s => s.productId)).size;
  const activeUsers = userSales.reduce((acc, s) => acc + s.unitsSold, 0);

  let forecastAccuracy = 0;
  const units = userSales.map(r => r.unitsSold || 0);
  if (units.length > 0) {
    const mean = units.reduce((a, b) => a + b, 0) / units.length;
    const variance = units.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / units.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean === 0 ? 0 : stdDev / mean;
    forecastAccuracy = Math.max(70, Math.min(99.5, 99.5 - (cv * 20)));
  }

  return c.json({
    totalRevenue: { value: totalRevenue, change: 12.5, changeLabel: 'vs last month' },
    activeProducts: { value: activeProducts, change: 4.2, changeLabel: 'new this month' },
    forecastAccuracy: { value: Number(forecastAccuracy.toFixed(1)), change: 2.1, changeLabel: 'improvement' },
    activeUsers: { value: activeUsers, change: 8.4, changeLabel: 'vs last week' },
  });
});

dashboardRoutes.get('/demand-forecast', zValidator('query', periodQuerySchema), async (c) => {
  const userId = c.get('userId');
  const data = await db.select().from(demandTimeseries).where(eq(demandTimeseries.userId, userId)).orderBy(desc(demandTimeseries.recordDate)).limit(90);

  return c.json({
    data: data.reverse().map(d => ({
      date: d.recordDate,
      actualDemand: d.actualDemand ? Number(d.actualDemand) : null,
      forecastDemand: d.forecastDemand ? Number(d.forecastDemand) : null,
    }))
  });
});

const monthPeriodSchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid period').optional().default('2025-01') });

dashboardRoutes.get('/channel-performance', zValidator('query', monthPeriodSchema), async (c) => {
  const userId = c.get('userId');
  const channels = await db.select().from(channelPerformance).where(eq(channelPerformance.userId, userId));
  
  return c.json({
    channels: channels.map(c => ({
      channel: c.channel,
      revenue: Number(c.revenue),
      percentage: Number(c.percentage)
    }))
  });
});

dashboardRoutes.get('/regional-revenue', zValidator('query', monthPeriodSchema), async (c) => {
  const userId = c.get('userId');
  const regions = await db.select().from(regionalRevenue).where(eq(regionalRevenue.userId, userId));
  
  return c.json({
    regions: regions.map(r => ({
      region: r.region,
      revenue: Number(r.revenue),
      percentage: Number(r.percentage)
    })).sort((a, b) => b.revenue - a.revenue)
  });
});

dashboardRoutes.get('/performance-metrics', async (c) => {
  const userId = c.get('userId');
  const metrics = await db.select().from(performanceMetrics).where(eq(performanceMetrics.userId, userId));
  
  const dimensions = [...new Set(metrics.map(m => m.dimension))];
  const current = dimensions.map(d => Number(metrics.find(m => m.dimension === d && m.period === 'current')?.value || 0));
  const previous = dimensions.map(d => Number(metrics.find(m => m.dimension === d && m.period === 'previous')?.value || 0));

  return c.json({
    dimensions,
    current,
    previous
  });
});

export default dashboardRoutes;
