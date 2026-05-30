import { describe, it, expect, beforeAll } from 'bun:test';
import app from '../src/index';
import { registerAndLogin, authHeader } from './helpers';

let token: string;
beforeAll(async () => { token = await registerAndLogin('markets@test.com', 'Pass1234!'); });

describe('GET /dashboard/market-forecasts', () => {
  it('returns summary and markets array', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts?region=all&period=2025-01', { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.summary).toBeDefined();
    expect(Array.isArray(body.markets)).toBe(true);
  });

  it('filters by region', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts?region=Europe&period=2025-01', { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    body.markets.forEach((m: any) => expect(m.region).toBe('Europe'));
  });

  it('each market has lat and lon', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts?region=all&period=2025-01', { headers: authHeader(token) });
    const body = (await res.json()) as any;
    body.markets.forEach((m: any) => {
      expect(typeof m.lat).toBe('number');
      expect(typeof m.lon).toBe('number');
    });
  });
});

describe('GET /dashboard/market-forecasts/top', () => {
  it('returns markets sorted by demand descending', async () => {
    const res = await app.request('/api/v1/dashboard/market-forecasts/top?limit=5', { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.markets.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < body.markets.length; i++) {
      expect(body.markets[i - 1].forecastedDemand).toBeGreaterThanOrEqual(body.markets[i].forecastedDemand);
    }
  });
});
