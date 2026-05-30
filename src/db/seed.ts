import { db } from './index';
import {
  users,
  kpiSnapshots,
  demandTimeseries,
  channelPerformance,
  performanceMetrics,
  regionalRevenue,
  marketForecasts,
} from './schema';
import * as bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('Starting seed...');

  // 1. Create User
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const result = await db
    .insert(users)
    .values({
      name: 'John Doe',
      email: 'john@databox.io',
      password: passwordHash,
      plan: 'pro',
    })
    .returning();

  const demoUser = result[0];
  if (!demoUser) {
    throw new Error('Failed to create demo user');
  }

  const userId = demoUser.id;
  console.log('Created demo user:', userId);

  // 2. KPI Snapshots
  await db.insert(kpiSnapshots).values({
    userId,
    snapshotDate: new Date().toISOString().split('T')[0]!,
    totalRevenue: '284521.00',
    activeProducts: 1847,
    forecastAccuracy: '94.20',
    activeUsers: 12489,
  });
  console.log('Inserted KPI Snapshot');

  // 3. Demand Timeseries (90 days)
  const timeseriesData = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0]!;
    timeseriesData.push({
      userId,
      recordDate: dateStr,
      actualDemand: (Math.random() * 1000 + 3000).toFixed(2),
      forecastDemand: (Math.random() * 1000 + 3000).toFixed(2),
    });
  }
  await db.insert(demandTimeseries).values(timeseriesData);
  console.log('Inserted 90 days of Demand Timeseries');

  // 4. Channel Performance (last 3 months)
  const channels = ['Online', 'Retail', 'Wholesale', 'Direct'];
  const channelData = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const period = d.toISOString().split('T')[0]!;
    let total = 0;
    const vals = channels.map((c) => {
      const v = Math.random() * 50000 + 10000;
      total += v;
      return { channel: c, val: v };
    });
    for (const c of vals) {
      channelData.push({
        userId,
        period,
        channel: c.channel,
        revenue: c.val.toFixed(2),
        percentage: ((c.val / total) * 100).toFixed(2),
      });
    }
  }
  await db.insert(channelPerformance).values(channelData);
  console.log('Inserted Channel Performance');

  // 5. Performance Metrics
  const dimensions = ['Sales', 'Marketing', 'Support', 'Logistics', 'Finance'];
  const metricsData = [];
  for (const period of ['current', 'previous']) {
    for (const dim of dimensions) {
      metricsData.push({
        userId,
        period,
        dimension: dim,
        value: (Math.random() * 30 + 70).toFixed(2),
      });
    }
  }
  await db.insert(performanceMetrics).values(metricsData);
  console.log('Inserted Performance Metrics');

  // 6. Regional Revenue (last 3 months)
  const regions = ['North', 'South', 'East', 'West'];
  const regionalData = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const period = d.toISOString().split('T')[0]!;
    let total = 0;
    const vals = regions.map((r) => {
      const v = Math.random() * 40000 + 20000;
      total += v;
      return { region: r, val: v };
    });
    for (const r of vals) {
      regionalData.push({
        userId,
        period,
        region: r.region,
        revenue: r.val.toFixed(2),
        percentage: ((r.val / total) * 100).toFixed(2),
      });
    }
  }
  await db.insert(regionalRevenue).values(regionalData);
  console.log('Inserted Regional Revenue');

  // 7. Market Forecasts (29 Markets)
  const rawMarkets = [
    { country: 'China', region: 'Asia Pacific', lat: 35.86, lon: 104.19 },
    { country: 'United States', region: 'North America', lat: 37.09, lon: -95.71 },
    { country: 'India', region: 'Asia Pacific', lat: 20.59, lon: 78.96 },
    { country: 'Japan', region: 'Asia Pacific', lat: 36.20, lon: 138.25 },
    { country: 'Germany', region: 'Europe', lat: 51.16, lon: 10.45 },
    { country: 'Brazil', region: 'South America', lat: -14.23, lon: -51.92 },
    { country: 'United Kingdom', region: 'Europe', lat: 55.37, lon: -3.43 },
    { country: 'France', region: 'Europe', lat: 46.22, lon: 2.21 },
    { country: 'South Korea', region: 'Asia Pacific', lat: 35.90, lon: 127.76 },
    { country: 'Canada', region: 'North America', lat: 56.13, lon: -106.34 },
    { country: 'Australia', region: 'Asia Pacific', lat: -25.27, lon: 133.77 },
    { country: 'Mexico', region: 'North America', lat: 23.63, lon: -102.55 },
    { country: 'Indonesia', region: 'Asia Pacific', lat: -0.78, lon: 113.92 },
    { country: 'Saudi Arabia', region: 'Middle East & Africa', lat: 23.88, lon: 45.07 },
    { country: 'UAE', region: 'Middle East & Africa', lat: 23.42, lon: 53.84 },
    { country: 'South Africa', region: 'Middle East & Africa', lat: -30.56, lon: 22.93 },
    { country: 'Nigeria', region: 'Middle East & Africa', lat: 9.08, lon: 8.67 },
    { country: 'Egypt', region: 'Middle East & Africa', lat: 26.82, lon: 30.80 },
    { country: 'Argentina', region: 'South America', lat: -38.41, lon: -63.61 },
    { country: 'Colombia', region: 'South America', lat: 4.57, lon: -74.29 },
    { country: 'Chile', region: 'South America', lat: -35.67, lon: -71.54 },
    { country: 'Spain', region: 'Europe', lat: 40.46, lon: -3.74 },
    { country: 'Italy', region: 'Europe', lat: 41.87, lon: 12.56 },
    { country: 'Netherlands', region: 'Europe', lat: 52.13, lon: 5.29 },
    { country: 'Sweden', region: 'Europe', lat: 60.12, lon: 18.64 },
    { country: 'Poland', region: 'Europe', lat: 51.91, lon: 19.14 },
    { country: 'Vietnam', region: 'Asia Pacific', lat: 14.05, lon: 108.27 },
    { country: 'Thailand', region: 'Asia Pacific', lat: 15.87, lon: 100.99 },
    { country: 'Philippines', region: 'Asia Pacific', lat: 12.87, lon: 121.77 },
  ];

  const currentMonthDate = new Date();
  currentMonthDate.setDate(1);
  const currentMonthStr = currentMonthDate.toISOString().split('T')[0]!;

  const marketData = rawMarkets.map((m) => {
    return {
      country: m.country,
      region: m.region,
      geom: [m.lon, m.lat] as [number, number],
      forecastedDemand: (Math.random() * 50000 + 10000).toFixed(2),
      currentStock: (Math.random() * 50000 + 8000).toFixed(2),
      confidence: (Math.random() * 20 + 75).toFixed(2),
      growthRate: (Math.random() * 30 - 10).toFixed(2),
      period: currentMonthStr,
    };
  });

  await db.insert(marketForecasts).values(marketData);
  console.log('Inserted Market Forecasts (29 Markets)');

  console.log('Seed completed successfully.');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
