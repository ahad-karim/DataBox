import { Hono } from 'hono';
import { db } from '../db';
import { rawData } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const rawDataRoutes = new Hono();

rawDataRoutes.use('*', authMiddleware);

rawDataRoutes.get('/', async (c) => {
  const data = await db.select().from(rawData).limit(50);
  
  return c.json({
    data: data.map(d => ({
      id: d.id,
      source: d.source,
      category: d.category,
      value: d.value ? Number(d.value) : null,
      metadata: d.metadata,
      recordDate: d.recordDate,
    })),
    pagination: { page: 1, limit: 50, total: 3200, totalPages: 64 }
  });
});

rawDataRoutes.get('/export', async (c) => {
  const data = await db.select().from(rawData).limit(50);
  
  const headers = ['id', 'source', 'category', 'value', 'recordDate'];
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    csvRows.push([row.id, row.source, row.category, row.value, row.recordDate].join(','));
  }
  
  const csvContent = csvRows.join('\n');
  
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', 'attachment; filename="raw-data.csv"');
  return c.body(csvContent);
});

export default rawDataRoutes;
