/**
 * Mirrors server/types.ts. Deliberately duplicated rather than imported -
 * see the comment at the top of server/types.ts for why.
 */

export type TestStatus = 'NOT_RUN' | 'RUNNING' | 'PASSED' | 'FAILED';

export interface TestExecution {
  id: string;
  name: string;
  status: TestStatus;
  description?: string;
  specFile?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  exitCode?: number;
  reportPath?: string;
  screenshotPaths?: string[];
  videoPaths?: string[];
  error?: string;
  logTail?: string;
}
