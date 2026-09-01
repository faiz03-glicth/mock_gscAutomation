import { useState } from 'react';
import { TestExecution } from '../types/test';

function formatTimestamp(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return '—';
  return `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * Detail panel for the currently-selected test: timestamps, duration,
 * fixed browser/mode (Chromium / Headed - this dashboard never runs
 * headless), links to the Playwright HTML report / screenshots / videos,
 * a collapsible raw log tail, and the error summary on failure.
 */
export default function TestDetails({ test }: { test: TestExecution }) {
  const [logsOpen, setLogsOpen] = useState(false);

  return (
    <div className="test-details">
      <h2>{test.name}</h2>
      {test.description && <p className="test-details__description">{test.description}</p>}

      <dl className="test-details__grid">
        <dt>Status</dt>
        <dd>{test.status}</dd>

        <dt>Browser</dt>
        <dd>Chromium</dd>

        <dt>Mode</dt>
        <dd>Headed</dd>

        <dt>Started</dt>
        <dd>{formatTimestamp(test.startedAt)}</dd>

        <dt>Finished</dt>
        <dd>{formatTimestamp(test.finishedAt)}</dd>

        <dt>Duration</dt>
        <dd>{formatDuration(test.durationMs)}</dd>

        {test.specFile && (
          <>
            <dt>Spec file</dt>
            <dd>{test.specFile}</dd>
          </>
        )}
      </dl>

      {test.error && (
        <div className="test-details__error">
          <strong>Error</strong>
          <pre>{test.error}</pre>
        </div>
      )}

      <div className="test-details__artifacts">
        {test.reportPath && (
          <a
            className="test-details__report-link"
            href={`/artifacts/${test.reportPath}`}
            target="_blank"
            rel="noreferrer"
          >
            Open Playwright HTML report ↗
          </a>
        )}

        {(test.screenshotPaths ?? []).map((p) => (
          <figure key={p} className="test-details__artifact">
            <figcaption>{p.split('/').pop()}</figcaption>
            <a href={`/artifacts/${p}`} target="_blank" rel="noreferrer">
              <img src={`/artifacts/${p}`} alt={p.split('/').pop()} loading="lazy" />
            </a>
          </figure>
        ))}

        {(test.videoPaths ?? []).map((p) => (
          <figure key={p} className="test-details__artifact">
            <figcaption>{p.split('/').pop()}</figcaption>
            <video src={`/artifacts/${p}`} controls preload="metadata" />
          </figure>
        ))}

        {!test.reportPath && !(test.screenshotPaths ?? []).length && !(test.videoPaths ?? []).length && (
          <span className="test-details__no-artifacts">No artifacts yet — run this test to generate one.</span>
        )}
      </div>

      {test.logTail && (
        <div className="test-details__logs">
          <button type="button" onClick={() => setLogsOpen((open) => !open)}>
            {logsOpen ? 'Hide raw logs' : 'Show raw logs'}
          </button>
          {logsOpen && <pre className="test-details__log-tail">{test.logTail}</pre>}
        </div>
      )}
    </div>
  );
}
