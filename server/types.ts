/**
 * Shared types for the dashboard's Node.js backend. Deliberately duplicated
 * (rather than imported) in dashboard/src/types/test.ts: the dashboard is a
 * separate Vite/TypeScript project with its own build, so a cross-project
 * import would either need a workspace setup or a relative path reaching
 * outside dashboard/'s root - not worth the complexity for a handful of
 * small interfaces.
 */

export type TestStatus = 'NOT_RUN' | 'RUNNING' | 'PASSED' | 'FAILED';

/** A statically-known test the dashboard can run - never derived from user input. */
export interface TestDefinition {
  id: string;
  name: string;
  description: string;
  /** Path to the spec file, relative to the repo root. */
  specFile: string;
}

/** The latest (or in-progress) execution state of one test, kept in memory. */
export interface TestExecution {
  id: string;
  name: string;
  status: TestStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number;
  /** Path to the Playwright HTML report's index.html, relative to the repo root. */
  reportPath?: string;
  /** Paths to this test's screenshots, relative to the repo root. */
  screenshotPaths?: string[];
  /** Paths to this test's video recordings, relative to the repo root. */
  videoPaths?: string[];
  /** Short, human-readable error summary, set only when status is FAILED. */
  error?: string;
  /** The last few KB of combined stdout/stderr from the Playwright process. */
  logTail?: string;
}
