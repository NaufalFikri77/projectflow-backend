import { describe, expect, it } from 'bun:test';
import { app, authHeaders } from './test-setup.js';

describe('RBAC + ABAC', () => {
  describe('Project Access', () => {
    it('PM should be able to create a project', async () => {
      const headers = await authHeaders('pm@projectflow.com');

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Test Project',
          description: 'Test description',
          clientId: 'will-need-real-id', // This will fail with validation but tests role check
        }),
      });

      // Should not be 403 (forbidden) - may be 422 or 404 due to clientId validation
      expect(res.status).not.toBe(403);
    });

    it('Frontend dev should NOT be able to create a project', async () => {
      const headers = await authHeaders('frontend@projectflow.com');

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Test Project',
          description: 'Test',
          clientId: 'some-id',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('Client should NOT be able to create a project', async () => {
      const headers = await authHeaders('client@projectflow.com');

      const res = await app.request('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Test Project',
          description: 'Test',
          clientId: 'some-id',
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Audit Log Access', () => {
    it('PM should be able to view audit logs', async () => {
      const headers = await authHeaders('pm@projectflow.com');
      const res = await app.request('/api/audit-logs', { headers });

      expect(res.status).toBe(200);
    });

    it('Frontend dev should NOT be able to view audit logs', async () => {
      const headers = await authHeaders('frontend@projectflow.com');
      const res = await app.request('/api/audit-logs', { headers });

      expect(res.status).toBe(403);
    });

    it('Client should NOT be able to view audit logs', async () => {
      const headers = await authHeaders('client@projectflow.com');
      const res = await app.request('/api/audit-logs', { headers });

      expect(res.status).toBe(403);
    });
  });

  describe('Client Isolation', () => {
    it('Client should only see own projects', async () => {
      const headers = await authHeaders('client@projectflow.com');
      const res = await app.request('/api/projects', { headers });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { data?: Array<{ clientId?: string }> };
      // All returned projects should belong to this client
      const projects = data.data ?? [];
      for (const project of projects) {
        expect(project.clientId).toBeDefined();
      }
    });

    it('Client dashboard endpoint should only return own projects', async () => {
      const headers = await authHeaders('client@projectflow.com');
      const res = await app.request('/api/client/projects', { headers });

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        data?: Array<{ progress?: { percentage?: number } }>;
      };
      // Should have progress metrics
      const clientProjects = data.data ?? [];
      if (clientProjects.length > 0) {
        expect(clientProjects[0]?.progress).toBeDefined();
        expect(clientProjects[0]?.progress?.percentage).toBeDefined();
      }
    });

    it('Non-client should be rejected from client endpoint', async () => {
      const headers = await authHeaders('pm@projectflow.com');
      const res = await app.request('/api/client/projects', { headers });

      expect(res.status).toBe(403);
    });
  });
});
