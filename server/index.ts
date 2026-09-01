import cors from 'cors';
import express from 'express';
import path from 'path';
import { findTestDefinition, testDefinitions } from './testDefinitions';
import {
  getAllExecutions,
  getExecution,
  getRunningTestId,
  isAnyTestRunning,
  runAllTests,
  runTest,
} from './testRunner';

const REPO_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

/** All tests, each with its latest known execution state. */
app.get('/api/tests', (_req, res) => {
  const payload = getAllExecutions().map((execution) => {
    const def = findTestDefinition(execution.id)!;
    return { ...execution, description: def.description, specFile: def.specFile };
  });
  res.json(payload);
});

/** Starts one predefined test. 404 for an unknown id, 409 if another test is already running. */
app.post('/api/tests/:testId/run', (req, res) => {
  const def = findTestDefinition(req.params.testId);
  if (!def) {
    res.status(404).json({ error: `Unknown test id: ${req.params.testId}` });
    return;
  }
  try {
    const execution = runTest(def.id);
    res.status(202).json(execution);
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Starts every test sequentially. Returns immediately; poll individual /status endpoints for progress. */
app.post('/api/tests/run-all', (_req, res) => {
  if (isAnyTestRunning()) {
    res.status(409).json({ error: `Cannot start "run all" - "${getRunningTestId()}" is already running.` });
    return;
  }
  runAllTests().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('run-all failed unexpectedly:', err);
  });
  res.status(202).json({ message: 'Run all started', testIds: testDefinitions.map((d) => d.id) });
});

/** Current status of one test (also doubles as the "result" endpoint - the record carries both). */
app.get('/api/tests/:testId/status', (req, res) => {
  const execution = getExecution(req.params.testId);
  if (!execution) {
    res.status(404).json({ error: `Unknown test id: ${req.params.testId}` });
    return;
  }
  res.json(execution);
});

app.get('/api/tests/:testId/result', (req, res) => {
  const execution = getExecution(req.params.testId);
  if (!execution) {
    res.status(404).json({ error: `Unknown test id: ${req.params.testId}` });
    return;
  }
  res.json(execution);
});

// Serves screenshots/videos and the Playwright HTML report straight from
// disk, so the dashboard can link directly to e.g.
// /artifacts/playwright-report/index.html or
// /artifacts/test-results/screenshots/01-movie-selected.png.
app.use('/artifacts/test-results', express.static(path.join(REPO_ROOT, 'test-results')));
app.use('/artifacts/playwright-report', express.static(path.join(REPO_ROOT, 'playwright-report')));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GSC automation dashboard API listening on http://localhost:${PORT}`);
});
