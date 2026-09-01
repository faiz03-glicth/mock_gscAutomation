import { TestExecution } from '../types/test';
import StatusBadge from './StatusBadge';

interface TestCaseCardProps {
  test: TestExecution;
  disabled: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
}

function formatDuration(durationMs?: number): string | null {
  if (durationMs === undefined) return null;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

/** One card per test: name, description, status, duration, and its own "Run Test" button. */
export default function TestCaseCard({ test, disabled, selected, onSelect, onRun }: TestCaseCardProps) {
  const duration = formatDuration(test.durationMs);

  return (
    <div
      className={`test-card ${selected ? 'test-card--selected' : ''}`}
      onClick={() => onSelect(test.id)}
      role="button"
      tabIndex={0}
    >
      <div className="test-card__header">
        <h3>{test.name}</h3>
        <StatusBadge status={test.status} />
      </div>
      {test.description && <p className="test-card__description">{test.description}</p>}
      <div className="test-card__meta">
        {duration && <span>Duration: {duration}</span>}
        {test.status === 'RUNNING' && <span>Running…</span>}
      </div>
      <button
        type="button"
        className="test-card__run-button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onRun(test.id);
        }}
      >
        {test.status === 'RUNNING' ? 'Running…' : 'Run Test'}
      </button>
    </div>
  );
}
