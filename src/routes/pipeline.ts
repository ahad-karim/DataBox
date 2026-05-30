import { Hono } from 'hono';
import { db } from '../db';
import { dataPipelineEvents } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { triggerPipelineSchema } from '../validators/schemas';
import { z } from 'zod';

const pipelineRoutes = new Hono<{ Variables: { userId: string } }>();

pipelineRoutes.use('*', authMiddleware);

const getEventsSchema = z.object({
  limit: z.string().transform(Number).optional().default(50),
  status: z.string().optional().default('all'),
});

pipelineRoutes.get('/events', zValidator('query', getEventsSchema), async (c) => {
  const userId = c.get('userId');
  const events = await db.select().from(dataPipelineEvents).limit(50); // simplified
  
  return c.json({
    events: events.map(e => ({
      id: e.id,
      eventType: e.eventType,
      source: e.source,
      status: e.status,
      rowsAffected: e.rowsAffected,
      message: e.message,
      createdAt: e.createdAt,
    }))
  });
});

pipelineRoutes.post('/trigger', zValidator('json', triggerPipelineSchema), async (c) => {
  const { source } = c.req.valid('json');
  // Mock trigger response
  return c.json({
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    status: 'running',
    message: `${source} Ingestion started`
  }, 202);
});

export default pipelineRoutes;
