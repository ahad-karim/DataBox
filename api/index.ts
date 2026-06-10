import { handle } from 'hono/vercel';
import app from '../src/index';

export const config = { runtime: 'nodejs' }; // PostGIS queries often require Node.js rather than Edge
export default handle(app);
