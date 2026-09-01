import { TestExecution } from '../types/test';

/**
 * Thin fetch wrapper around the backend's REST API. All paths are relative
 * (`/api/...`) so this works unchanged in dev (proxied by Vite to
 * http://localhost:3000, see vite.config.ts) and in any future production
 * build served by the same Express app.
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchTests(): Promise<TestExecution[]> {
  return request<TestExecution[]>('/api/tests');
}

export function fetchTestStatus(testId: string): Promise<TestExecution> {
  return request<TestExecution>(`/api/tests/${encodeURIComponent(testId)}/status`);
}

export function runTest(testId: string): Promise<TestExecution> {
  return request<TestExecution>(`/api/tests/${encodeURIComponent(testId)}/run`, { method: 'POST' });
}

export function runAllTests(): Promise<{ message: string; testIds: string[] }> {
  return request(`/api/tests/run-all`, { method: 'POST' });
}
