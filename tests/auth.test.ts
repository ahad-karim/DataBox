import { describe, it, expect } from 'bun:test';
import app from '../src/index';
import { registerAndLogin } from './helpers';

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@test.com', password: 'Pass1234!' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe('alice@test.com');
  });

  it('returns 400 for duplicate email', async () => {
    const payload = JSON.stringify({ name: 'Bob', email: 'bob@test.com', password: 'Pass1234!' });
    await app.request('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    const res = await app.request('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', email: 'not-an-email', password: 'Pass1234!' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.com', password: 'Pass1234!' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.com', password: 'wrongpass' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns user profile with valid token', async () => {
    const token = await registerAndLogin('me@test.com', 'Pass1234!');
    const res = await app.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.email).toBe('me@test.com');
  });

  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
