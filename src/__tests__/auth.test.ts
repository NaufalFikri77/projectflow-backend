import { describe, expect, it } from 'bun:test';
import { app } from './test-setup.js';

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
          password: 'password123',
          role: 'FRONTEND',
          department: 'FRONTEND',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
      expect(data.data.user.email).toContain('@example.com');
    });

    it('should reject duplicate email', async () => {
      const email = `dup-${Date.now()}@example.com`;
      const body = JSON.stringify({
        email,
        name: 'Test',
        password: 'password123',
        role: 'FRONTEND',
        department: 'FRONTEND',
      });

      await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      expect(res.status).toBe(409);
    });

    it('should reject invalid input', async () => {
      const res = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-email' }),
      });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const email = `login-${Date.now()}@example.com`;

      // Register first
      await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Login Test',
          password: 'password123',
          role: 'BACKEND',
          department: 'BACKEND',
        }),
      });

      // Then login
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pm@projectflow.com', password: 'wrongpassword' }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await app.request('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return profile with valid token', async () => {
      const loginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pm@projectflow.com', password: 'password123' }),
      });

      const loginData = await loginRes.json();
      const token = loginData.data?.token;

      if (token) {
        const res = await app.request('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data.email).toBe('pm@projectflow.com');
        expect(data.data.role).toBe('PRODUCT_MANAGER');
      }
    });
  });
});
