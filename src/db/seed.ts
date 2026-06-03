import { db } from './index';
import {
  users,
  kpiSnapshots,
  demandTimeseries,
  channelPerformance,
  performanceMetrics,
  regionalRevenue,
  marketForecasts,
  rawData,
} from './schema';
import * as bcrypt from 'bcryptjs';

async function seed() {
  console.log('Starting seed...');

  // 0. Clean database for idempotency
  console.log('Cleaning existing database rows...');
  await db.delete(kpiSnapshots);
  await db.delete(demandTimeseries);
  await db.delete(channelPerformance);
  await db.delete(performanceMetrics);
  await db.delete(regionalRevenue);
  await db.delete(marketForecasts);
  await db.delete(rawData);
  await db.delete(users);

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

  // 2. Raw SME Sales Data
  const sampleSales = [
    { date: '2026-05-01', productName: 'Aarong Milk 1L', category: 'Dairy', location: 'Dhaka', salesChannel: 'Retail', unitsSold: 120, revenueBdt: '14400.00', unitPrice: '120.00', costPrice: '90.00', currentStock: 450, productId: 'PRD-MILK', customerSegment: 'Consumer' },
    { date: '2026-05-02', productName: 'Pran Mango Juice 250ml', category: 'Beverages', location: 'Chattogram', salesChannel: 'Wholesale', unitsSold: 500, revenueBdt: '15000.00', unitPrice: '30.00', costPrice: '22.50', currentStock: 1200, productId: 'PRD-JUICE', customerSegment: 'Retailer' },
    { date: '2026-05-03', productName: 'RFL Plastic Chair', category: 'Furniture', location: 'Sylhet', salesChannel: 'Direct', unitsSold: 45, revenueBdt: '29250.00', unitPrice: '650.00', costPrice: '450.00', currentStock: 80, productId: 'PRD-CHAIR', customerSegment: 'Corporate' },
    { date: '2026-05-04', productName: 'Radhuni Chilli Powder 200g', category: 'Grocery', location: 'Khulna', salesChannel: 'Retail', unitsSold: 250, revenueBdt: '20000.00', unitPrice: '80.00', costPrice: '60.00', currentStock: 600, productId: 'PRD-CHILLI', customerSegment: 'Consumer' },
    { date: '2026-05-05', productName: 'Ispahani Mirzapore Tea 500g', category: 'Food', location: 'Dhaka', salesChannel: 'Online', unitsSold: 180, revenueBdt: '45000.00', unitPrice: '250.00', costPrice: '190.00', currentStock: 300, productId: 'PRD-TEA', customerSegment: 'Consumer' },
    { date: '2026-05-08', productName: 'Aarong Milk 1L', category: 'Dairy', location: 'Dhaka', salesChannel: 'Retail', unitsSold: 150, revenueBdt: '18000.00', unitPrice: '120.00', costPrice: '90.00', currentStock: 300, productId: 'PRD-MILK', customerSegment: 'Consumer' },
    { date: '2026-05-09', productName: 'Pran Mango Juice 250ml', category: 'Beverages', location: 'Chattogram', salesChannel: 'Online', unitsSold: 350, revenueBdt: '10500.00', unitPrice: '30.00', costPrice: '22.50', currentStock: 850, productId: 'PRD-JUICE', customerSegment: 'Consumer' },
    { date: '2026-05-15', productName: 'RFL Plastic Chair', category: 'Furniture', location: 'Rajshahi', salesChannel: 'Wholesale', unitsSold: 60, revenueBdt: '39000.00', unitPrice: '650.00', costPrice: '450.00', currentStock: 120, productId: 'PRD-CHAIR', customerSegment: 'Small Business' },
    { date: '2026-05-22', productName: 'Radhuni Chilli Powder 200g', category: 'Grocery', location: 'Barishal', salesChannel: 'Direct', unitsSold: 190, revenueBdt: '15200.00', unitPrice: '80.00', costPrice: '60.00', currentStock: 410, productId: 'PRD-CHILLI', customerSegment: 'Consumer' },
    { date: '2026-05-29', productName: 'Ispahani Mirzapore Tea 500g', category: 'Food', location: 'Sylhet', salesChannel: 'Retail', unitsSold: 220, revenueBdt: '55000.00', unitPrice: '250.00', costPrice: '190.00', currentStock: 180, productId: 'PRD-TEA', customerSegment: 'Consumer' },
  ];

  await db.insert(rawData).values(
    sampleSales.map(s => ({
      userId,
      ...s
    }))
  );
  console.log('Inserted Raw SME Sales Data');

  // Calculate Aggregates dynamically from Raw Sales
  const totalRevenueVal = sampleSales.reduce((sum, item) => sum + parseFloat(item.revenueBdt), 0);
  const activeProductsVal = new Set(sampleSales.map(item => item.productId)).size;
  const activeUsersVal = sampleSales.reduce((sum, item) => sum + item.unitsSold, 0);

  // 3. KPI Snapshots
  await db.insert(kpiSnapshots).values({
    userId,
    snapshotDate: new Date().toISOString().split('T')[0]!,
    totalRevenue: totalRevenueVal.toFixed(2),
    activeProducts: activeProductsVal,
    forecastAccuracy: '94.20',
    activeUsers: activeUsersVal,
  });
  console.log('Inserted Calculated KPI Snapshot');

  // 4. Demand Timeseries (90 days, scaled to match raw sales demand)
  const dailySalesTotals: Record<string, number> = {};
  sampleSales.forEach(s => {
    dailySalesTotals[s.date] = (dailySalesTotals[s.date] || 0) + s.unitsSold;
  });

  const timeseriesData = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0]!;
    
    // Use actual units sold if we have raw sales data for that day, otherwise scale randomly
    const actualDemandVal = dailySalesTotals[dateStr] !== undefined
      ? dailySalesTotals[dateStr]
      : Math.floor(Math.random() * 150 + 50);

    const forecastDemandVal = actualDemandVal * (0.9 + Math.random() * 0.2);

    timeseriesData.push({
      userId,
      recordDate: dateStr,
      actualDemand: actualDemandVal.toFixed(2),
      forecastDemand: forecastDemandVal.toFixed(2),
    });
  }
  await db.insert(demandTimeseries).values(timeseriesData);
  console.log('Inserted 90 days of calculated Demand Timeseries');

  // 5. Channel Performance (Calculated from Raw Sales)
  const channelTotals: Record<string, number> = {};
  sampleSales.forEach(s => {
    channelTotals[s.salesChannel] = (channelTotals[s.salesChannel] || 0) + parseFloat(s.revenueBdt);
  });
  const totalChannelRevenue = Object.values(channelTotals).reduce((a, b) => a + b, 0) || 1;
  
  const channelData = Object.entries(channelTotals).map(([channel, rev]) => ({
    userId,
    period: '2026-05-01',
    channel,
    revenue: rev.toFixed(2),
    percentage: ((rev / totalChannelRevenue) * 100).toFixed(2),
  }));
  await db.insert(channelPerformance).values(channelData);
  console.log('Inserted Calculated Channel Performance');

  // 6. Performance Metrics (Realistic baseline)
  const dimensions = ['Sales', 'Marketing', 'Support', 'Logistics', 'Finance'];
  const metricsData = [
    { userId, period: 'current', dimension: 'Sales', value: '88.50' },
    { userId, period: 'current', dimension: 'Marketing', value: '74.00' },
    { userId, period: 'current', dimension: 'Support', value: '91.20' },
    { userId, period: 'current', dimension: 'Logistics', value: '82.50' },
    { userId, period: 'current', dimension: 'Finance', value: '95.00' },
    { userId, period: 'previous', dimension: 'Sales', value: '82.00' },
    { userId, period: 'previous', dimension: 'Marketing', value: '78.50' },
    { userId, period: 'previous', dimension: 'Support', value: '85.00' },
    { userId, period: 'previous', dimension: 'Logistics', value: '80.00' },
    { userId, period: 'previous', dimension: 'Finance', value: '91.00' },
  ];
  await db.insert(performanceMetrics).values(metricsData);
  console.log('Inserted Calculated Performance Metrics');

  // 7. Regional Revenue (Calculated from Raw Sales)
  const regionalTotals: Record<string, number> = {};
  sampleSales.forEach(s => {
    regionalTotals[s.location] = (regionalTotals[s.location] || 0) + parseFloat(s.revenueBdt);
  });
  const totalRegionalRevenue = Object.values(regionalTotals).reduce((a, b) => a + b, 0) || 1;

  const regionalData = Object.entries(regionalTotals).map(([region, rev]) => ({
    userId,
    period: '2026-05-01',
    region,
    revenue: rev.toFixed(2),
    percentage: ((rev / totalRegionalRevenue) * 100).toFixed(2),
  }));
  await db.insert(regionalRevenue).values(regionalData);
  console.log('Inserted Calculated Regional Revenue');

  // 8. Market Forecasts (29 Markets)
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
