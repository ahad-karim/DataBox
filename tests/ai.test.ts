import { describe, it, expect, beforeAll } from 'bun:test';
import app from '../src/index';
import { registerAndLogin, authHeader } from './helpers';

let token: string;
beforeAll(async () => { token = await registerAndLogin('ai@test.com', 'Pass1234!'); });

describe('POST /ai/insights', () => {
  it('returns an array of insight strings', async () => {
    const res = await app.request('/api/v1/ai/insights', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'kpis', data: { totalRevenue: 284521 } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.insights)).toBe(true);
    expect(body.insights.length).toBeGreaterThan(0);
  });

  it('returns 400 if context is missing', async () => {
    const res = await app.request('/api/v1/ai/insights', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /dashboard/demand-forecast/generate', () => {
  it('returns forecast array', async () => {
    const res = await app.request('/api/v1/dashboard/demand-forecast/generate', {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ horizonDays: 7, includeSeasonality: false }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body.forecast)).toBe(true);
  });
});
