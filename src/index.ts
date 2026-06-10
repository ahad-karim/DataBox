import { Hono } from 'hono';
import { cors } from 'hono/cors';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import marketsRoutes from './routes/markets';
import pipelineRoutes from './routes/pipeline';
import rawDataRoutes from './routes/rawData';
import aiRoutes, { generateForecastRoute } from './routes/ai';
import notificationsRoutes from './routes/notifications';
import uploadRoutes from './routes/upload';
import datasetRoutes from './routes/datasets';
import integrationsRoutes from './routes/integrations';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === process.env.CORS_ORIGIN) {
      return origin;
    }
    return process.env.CORS_ORIGIN ?? 'https://ai-buildfest.netlify.app';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.text('DataBox API is running'));

// Auth
app.route('/api/v1/auth', authRoutes);

// Dashboard
app.route('/api/v1/dashboard', dashboardRoutes);
app.route('/api/v1/dashboard/market-forecasts', marketsRoutes);
app.route('/api/v1/dashboard/pipeline', pipelineRoutes);
app.route('/api/v1/dashboard/raw-data', rawDataRoutes);
app.route('/api/v1/dashboard/demand-forecast/generate', generateForecastRoute);

// AI — includes /insights, /chat, /impute, /forecast-insight
app.route('/api/v1/ai', aiRoutes);

// Notifications
app.route('/api/v1/notifications', notificationsRoutes);

// CSV / JSON Upload
app.route('/api/v1/data/upload', uploadRoutes);
app.route('/api/v1/data/datasets', datasetRoutes);

// Integrations
app.route('/api/v1/integrations', integrationsRoutes);

// Error handling
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message, code: 'INTERNAL_ERROR', details: {} }, 500);
});

// Start server explicitly for Render (picks up PORT env var)
const port = parseInt(process.env.PORT ?? '3001', 10);
console.log(`DataBox API starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

