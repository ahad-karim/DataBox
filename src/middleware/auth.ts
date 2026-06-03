import { verify } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Unauthorized', code: 'MISSING_TOKEN', details: {} }, 401);
  }
  try {
    const payload = await verify(token, process.env.JWT_SECRET || 'test_secret', 'HS256');
    const userId = payload.sub as string;

    // Verify user exists in the database
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return c.json({ error: 'Unauthorized: User not found', code: 'USER_NOT_FOUND', details: {} }, 401);
    }

    c.set('userId', userId);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN', details: {} }, 401);
  }
};
