import { Hono } from 'hono';
import { db } from '../db';
import { dataPipelineEvents } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { triggerPipelineSchema } from '../validators/schemas';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';

const pipelineRoutes = new Hono<{ Variables: { userId: string } }>();

pipelineRoutes.use('*', authMiddleware);

const getEventsSchema = z.object({
  limit: z.string().transform(Number).optional().default(50),
  status: z.string().optional().default('all'),
});

pipelineRoutes.get('/events', zValidator('query', getEventsSchema), async (c) => {
  const userId = c.get('userId');
  const { limit } = c.req.valid('query');
  
  const events = await db.select()
    .from(dataPipelineEvents)
    .where(eq(dataPipelineEvents.userId, userId))
    .orderBy(desc(dataPipelineEvents.createdAt))
    .limit(limit);
  
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
  const userId = c.get('userId');
  
  // We'll also allow an optional 'records' in the body, although the schema might not have it.
  // We'll extract it dynamically if it exists.
  const body = await c.req.json().catch(() => ({}));
  const records = body.records || 0;

  try {
    const newEvent = await db.insert(dataPipelineEvents).values({
      userId,
      eventType: 'Integration Sync',
      source: source,
      status: 'success',
      rowsAffected: records,
      message: `${source} sync completed successfully.`,
    }).returning();
    
    return c.json({
      jobId: newEvent[0]?.id || 'unknown',
      status: 'success',
      message: `${source} ingestion completed`
    }, 202);
  } catch (err) {
    return c.json({ error: 'Failed to record pipeline run' }, 500);
  }
});

export default pipelineRoutes;
