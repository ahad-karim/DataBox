import { Hono } from 'hono';
import { db } from '../db';
import { datasets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { recalculateDashboard } from '../services/dashboard';

const datasetRoutes = new Hono<{ Variables: { userId: string } }>();

datasetRoutes.use('*', authMiddleware);

datasetRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  try {
    const userDatasets = await db.select().from(datasets).where(eq(datasets.userId, userId));
    return c.json({ datasets: userDatasets }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch datasets' }, 500);
  }
});

datasetRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const datasetId = c.req.param('id');

  try {
    // 1. Verify dataset belongs to user
    const dataset = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
    if (!dataset || dataset.length === 0 || dataset[0]?.userId !== userId) {
      return c.json({ error: 'Dataset not found or unauthorized' }, 404);
    }

    // 2. Delete dataset (cascades to salesFacts and inventoryFacts)
    await db.delete(datasets).where(eq(datasets.id, datasetId));

    // 3. Recalculate dashboard metrics
    await recalculateDashboard(userId);
    
    return c.json({ message: 'Dataset deleted successfully' }, 200);
  } catch (error) {
    console.error('Delete dataset error:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default datasetRoutes;
