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

// Standard valid CSV containing all required columns
const validCSV = [
  'Date,Product_Name,Category,Location,Sales_Channel,Units_Sold,Revenue_BDT,Cost_Price,Current_Stock',
  '2026-05-01,Aarong Milk 1L,Dairy,Dhaka,Retail,120,14400.00,90.00,450',
  '2026-05-02,Pran Mango Juice 250ml,Beverages,Chattogram,Wholesale,500,15000.00,22.50,1200'
].join('\n');

describe('POST /data/upload', () => {
  it('uploads a valid sales CSV and returns rowsInserted', async () => {
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(validCSV, 'sales'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rowsInserted).toBe(2);
  });

  it('uploads a valid demand CSV', async () => {
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(validCSV, 'demand'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rowsInserted).toBe(2);
  });

  it('skips invalid rows and reports them', async () => {
    const csv = [
      'Date,Product_Name,Category,Location,Sales_Channel,Units_Sold,Revenue_BDT,Cost_Price,Current_Stock',
      '2026-05-01,Aarong Milk 1L,Dairy,Dhaka,Retail,120,14400.00,90.00,450',
      'not-a-date,Aarong Milk 1L,Dairy,Dhaka,Retail,120,14400.00,90.00,450'
    ].join('\n');

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
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(validCSV, 'unknown_type'),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      body: makeFormData(validCSV, 'sales'),
    });
    expect(res.status).toBe(401);
  });

  it('returns 413 for file over 5MB', async () => {
    const bigCSV = 'Date,Product_Name,Category,Location,Sales_Channel,Units_Sold,Revenue_BDT,Cost_Price,Current_Stock\n' + 
      '2026-05-01,Aarong Milk 1L,Dairy,Dhaka,Retail,120,14400.00,90.00,450\n'.repeat(100000);
    const res = await app.request('/api/v1/data/upload', {
      method: 'POST',
      headers: authHeader(token),
      body: makeFormData(bigCSV, 'sales'),
    });
    expect(res.status).toBe(413);
  });
});
