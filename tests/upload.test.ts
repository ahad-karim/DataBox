import { describe, it, expect, beforeAll } from 'bun:test';
import app from '../src/index';
import { registerAndLogin, authHeader } from './helpers';

let token: string;
beforeAll(async () => {
  token = await registerAndLogin('upload@test.com', 'Pass1234!');
});

const makeFormData = (csvContent: string, type: string) => {
  const form = new FormData();
  form.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test.csv');
  form.append('type', type);
  return form;
};

describe('POST /data/upload', () => {
  it('uploads a valid sales CSV and returns rowsInserted', async () => {
    const csv = `date,source,category,value\n2025-01-01,Shopify,Orders,1200\n2025-01-02,Shopify,Orders,950`;
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'sales'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rowsInserted).toBe(2);
  });

  it('uploads a valid demand CSV', async () => {
    const csv = `date,actual_demand,forecast_demand\n2025-01-01,4200,4050\n2025-01-02,4350,4300`;
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'demand'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rowsInserted).toBe(2);
  });

  it('skips invalid rows and reports them', async () => {
    const csv = `date,source,category,value\n2025-01-01,Shopify,Orders,1200\nnot-a-date,Shopify,Orders,950`;
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'sales'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rowsInserted).toBe(1);
    expect(body.rowsSkipped).toBe(1);
  });

  it('returns 400 for unknown type', async () => {
    const csv = `date,value\n2025-01-01,100`;
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(csv, 'unknown_type'),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csv = `date,source,category,value\n2025-01-01,Shopify,Orders,1200`;
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      body: makeFormData(csv, 'sales'),
    });
    expect(res.status).toBe(401);
  });

  it('returns 413 for file over 5MB', async () => {
    const bigCSV = 'date,source,category,value\n' + '2025-01-01,Shopify,Orders,100\n'.repeat(300000);
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(bigCSV, 'sales'),
    });
    expect(res.status).toBe(413);
  });
});
