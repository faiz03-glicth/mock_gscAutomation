import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { testDefinitions, findTestDefinition } from './testDefinitions';
import { TestExecution } from './types';

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Each spec writes its own checkpoint screenshots to these fixed paths (see
 * the `page.screenshot({ path: ... })` calls inside the spec files
 * themselves). These live directly under `test-results/screenshots/` -
 * *outside* any run's isolated `--output` directory (see `runTest` below) -
 * specifically so a later run's isolated output directory never touches
 * them; each is simply overwritten in place the next time its own spec
 * runs.
 */
const KNOWN_SCREENSHOTS: Record<string, string[]> = {
  login: ['test-results/screenshots/00-login-success.png'],
  'browse-and-select': ['test-results/screenshots/01-movie-selected.png'],
  'select-showtime': ['test-results/screenshots/02-showtime-selected.png'],
  'continue-booking': [
    'test-results/screenshots/03-showtime-selected.png',
    'test-results/screenshots/03-seat-selected.png',
    'test-results/screenshots/03-review-checkout.png',
  ],
  'negative-validation': [
    'test-results/screenshots/04-coming-soon-unavailable.png',
    'test-results/screenshots/04-no-booking-action.png',
  ],
  'search-movie-trailer': ['test-results/screenshots/05-trailer-paused.png'],
};

const executions = new Map<string, TestExecution>();
for (const def of testDefinitions) {
  executions.set(def.id, { id: def.id, name: def.name, status: 'NOT_RUN' });
}

/**
 * The id of the currently-running test, or null. Only one Playwright
 * process runs at a time across the whole server - these are real, visible
 * headed Chromium sessions against the live GSC site, and two running at
 * once would fight over the same visible window and the same GSC session.
 * This single flag is what "Run Test" (individual) and "Run All Tests"
 * (sequential) both check before starting anything.
 */
let runningTestId: string | null = null;

export function getAllExecutions(): TestExecution[] {
  return testDefinitions.map((def) => executions.get(def.id)!);
}

export function getExecution(id: string): TestExecution | undefined {
  return executions.get(id);
}

export function isAnyTestRunning(): boolean {
  return runningTestId !== null;
}

export function getRunningTestId(): string | null {
  return runningTestId;
}

/** Converts an OS-specific relative path (which may contain `\` on Windows) to a URL-safe, forward-slash path. */
function toUrlPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

/**
 * Recursively finds the most recently modified file under `dir` matching
 * one of `extensions`. Used to locate the video Playwright's own reporter
 * wrote for this run, since it lives in an auto-generated per-test folder
 * name (e.g. `Browse-and-select-.../video.webm`) that isn't practical to
 * predict in advance. `dir` is now always this run's own isolated output
 * directory (see `runTest`), so there is no need to filter by timestamp -
 * nothing else has ever written into it.
 */
function findNewestArtifact(dir: string, extensions: string[]): string | undefined {
  if (!fs.existsSync(dir)) return undefined;

  let newest: { fullPath: string; mtimeMs: number } | undefined;

  const walk = (current: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        const stat = fs.statSync(fullPath);
        if (!newest || stat.mtimeMs > newest.mtimeMs) {
          newest = { fullPath, mtimeMs: stat.mtimeMs };
        }
      }
    }
  };

  walk(dir);
  return newest ? toUrlPath(path.relative(REPO_ROOT, newest.fullPath)) : undefined;
}

/**
 * Starts one Playwright spec file with `--headed`, in a real child process
 * (a fixed argv array - never a shell string assembled from the request),
 * and updates the in-memory execution record as it progresses. Returns
 * immediately with the RUNNING record; the final PASSED/FAILED state lands
 * asynchronously when the process exits, and the client learns of it by
 * polling GET /api/tests/:id/status.
 *
 * Each run gets its own isolated `--output` directory
 * (`test-results/runs/<runId>`) and its own HTML report folder
 * (`playwright-report/runs/<runId>`, via the `PLAYWRIGHT_HTML_REPORT` env
 * var Playwright's own html reporter reads). This matters because
 * Playwright wipes its configured output directory at the start of every
 * run - without this isolation, running a second test would delete the
 * first test's video/screenshots/report out from under the dashboard,
 * leaving its "View Details" links pointing at files that no longer exist.
 *
 * Throws if another test is already running - the caller (index.ts) turns
 * that into an HTTP 409, rather than silently queueing or killing the
 * in-progress run.
 */
export function runTest(id: string): TestExecution {
  const def = findTestDefinition(id);
  if (!def) {
    throw new Error(`Unknown test id: ${id}`);
  }
  if (runningTestId !== null) {
    throw new Error(`Cannot start "${id}" - "${runningTestId}" is already running.`);
  }

  const startedAt = new Date();
  runningTestId = id;

  const runId = `${id}-${startedAt.getTime()}`;
  const outputDirRelative = path.posix.join('test-results', 'runs', runId);
  const reportDirRelative = path.posix.join('playwright-report', 'runs', runId);
  const outputDirAbsolute = path.join(REPO_ROOT, ...outputDirRelative.split('/'));

  const execution: TestExecution = {
    id: def.id,
    name: def.name,
    status: 'RUNNING',
    startedAt: startedAt.toISOString(),
  };
  executions.set(id, execution);

  // `def.specFile` came from the predefined table above, keyed by `id` -
  // never anything supplied directly by the HTTP request. `shell: true` is
  // needed only so Windows can resolve `npx.cmd`; the arguments are still
  // passed as a fixed array, not concatenated into a shell string.
  const child = spawn(
    'npx',
    ['playwright', 'test', def.specFile, '--headed', '--reporter=list,html', '--output', outputDirRelative],
    {
      cwd: REPO_ROOT,
      shell: process.platform === 'win32',
      env: { ...process.env, PLAYWRIGHT_HTML_REPORT: reportDirRelative },
    }
  );

  let logTail = '';
  const appendLog = (chunk: Buffer) => {
    logTail = (logTail + chunk.toString()).slice(-8_000);
  };
  child.stdout?.on('data', appendLog);
  child.stderr?.on('data', appendLog);

  child.on('close', (exitCode) => {
    const finishedAt = new Date();
    const passed = exitCode === 0;

    executions.set(id, {
      ...execution,
      status: passed ? 'PASSED' : 'FAILED',
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      exitCode: exitCode ?? undefined,
      reportPath: `${reportDirRelative}/index.html`,
      screenshotPaths: (KNOWN_SCREENSHOTS[id] ?? []).filter((p) => fs.existsSync(path.join(REPO_ROOT, p))),
      videoPaths: [findNewestArtifact(outputDirAbsolute, ['.webm'])].filter((p): p is string => Boolean(p)),
      logTail,
      error: passed ? undefined : logTail.slice(-2_000) || `Playwright exited with code ${exitCode}`,
    });
    runningTestId = null;
  });

  child.on('error', (err) => {
    const finishedAt = new Date();
    executions.set(id, {
      ...execution,
      status: 'FAILED',
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      error: `Failed to start Playwright: ${err.message}`,
    });
    runningTestId = null;
  });

  return execution;
}

/** Resolves once the given test's execution record leaves RUNNING. */
function waitForCompletion(id: string): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const current = executions.get(id);
      if (current && current.status !== 'RUNNING') {
        resolve();
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });
}

/**
 * Runs every test one after another - never in parallel, for the same
 * single-headed-browser reason `runTest` enforces above. Each step waits
 * for the previous one to finish before the next starts, which is also
 * what keeps the pipeline UI's "only one node RUNNING at a time" behaviour
 * accurate during "Run All Tests".
 */
export async function runAllTests(): Promise<void> {
  if (runningTestId !== null) {
    throw new Error(`Cannot start "run all" - "${runningTestId}" is already running.`);
  }
  for (const def of testDefinitions) {
    runTest(def.id);
    await waitForCompletion(def.id);
  }
}
