import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

const notificationsRoutes = new Hono<{ Variables: { userId: string } }>();

notificationsRoutes.use('*', authMiddleware);

// In-memory per-user store (swap for a DB table if persistence is needed)
const userNotifications: Record<string, any[]> = {};

function getStore(userId: string) {
  if (!userNotifications[userId]) userNotifications[userId] = [];
  return userNotifications[userId];
}

notificationsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const store = getStore(userId);
  const unreadCount = store.filter(n => !n.read).length;
  return c.json({ notifications: store, unreadCount });
});

notificationsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const { title, message } = body;
  const notif = {
    id: crypto.randomUUID(),
    type: 'info',
    title: title || 'Notification',
    message: message || '',
    read: false,
    createdAt: new Date().toISOString(),
  };
  getStore(userId).unshift(notif);
  return c.json(notif, 201);
});

notificationsRoutes.patch('/all/read', async (c) => {
  const userId = c.get('userId');
  getStore(userId).forEach(n => { n.read = true; });
  return c.json({ success: true });
});

notificationsRoutes.patch('/:id/read', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const store = getStore(userId);
  const notif = store.find(n => n.id === id);
  if (notif) notif.read = true;
  return c.json({ success: true });
});

export default notificationsRoutes;
