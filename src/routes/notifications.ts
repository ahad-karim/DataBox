import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

const notificationsRoutes = new Hono();

notificationsRoutes.use('*', authMiddleware);

notificationsRoutes.get('/', async (c) => {
  return c.json({
    notifications: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'alert',
        message: 'Forecast accuracy dropped below 90% for Asia Pacific',
        read: false,
        createdAt: new Date().toISOString()
      }
    ],
    unreadCount: 1
  });
});

notificationsRoutes.patch('/:id/read', async (c) => {
  return c.json({ success: true });
});

export default notificationsRoutes;
