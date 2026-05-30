import { verify } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Unauthorized', code: 'MISSING_TOKEN', details: {} }, 401);
  }
  try {
    const payload = await verify(token, process.env.JWT_SECRET || 'test_secret', 'HS256');
    c.set('userId', payload.sub as string);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN', details: {} }, 401);
  }
};
