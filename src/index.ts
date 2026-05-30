import { Hono } from 'hono';
import { cors } from 'hono/cors';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import marketsRoutes from './routes/markets';
import pipelineRoutes from './routes/pipeline';
import rawDataRoutes from './routes/rawData';
import aiRoutes, { generateForecastRoute } from './routes/ai';
import notificationsRoutes from './routes/notifications';

const app = new Hono();

app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'https://ai-buildfest.netlify.app',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.text('DataBox API is running'));

app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/dashboard/kpis', dashboardRoutes); // Let's mount dashboard properly
// Wait, the routes in dashboard.ts are:
// `/kpis`
// `/demand-forecast`
// `/channel-performance`
// `/regional-revenue`
// `/performance-metrics`
// So I should mount dashboardRoutes to `/api/v1/dashboard`
app.route('/api/v1/dashboard', dashboardRoutes);
// And marketsRoutes has `/` and `/top`, mount to `/api/v1/dashboard/market-forecasts`
app.route('/api/v1/dashboard/market-forecasts', marketsRoutes);
// And pipelineRoutes has `/events` and `/trigger`, mount to `/api/v1/dashboard/pipeline`
app.route('/api/v1/dashboard/pipeline', pipelineRoutes);
// And rawDataRoutes has `/` and `/export`, mount to `/api/v1/dashboard/raw-data`
app.route('/api/v1/dashboard/raw-data', rawDataRoutes);
// And AI routes `/insights`
app.route('/api/v1/ai', aiRoutes);
// And AI forecast generation `/api/v1/dashboard/demand-forecast/generate`
app.route('/api/v1/dashboard/demand-forecast/generate', generateForecastRoute);
// Notifications
app.route('/api/v1/notifications', notificationsRoutes);

// Error handling
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message, code: 'INTERNAL_ERROR', details: {} }, 500);
});

export default app;
