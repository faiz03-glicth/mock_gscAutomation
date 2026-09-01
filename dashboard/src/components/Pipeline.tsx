import { TestExecution } from '../types/test';
import StatusBadge from './StatusBadge';

interface PipelineProps {
  tests: TestExecution[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * GitLab-CI-style row of connected pipeline nodes: one circle per test,
 * colored by status, joined by connector lines, in the fixed order the
 * backend's testDefinitions table defines. Clicking a node selects it for
 * the details panel below.
 */
export default function Pipeline({ tests, selectedId, onSelect }: PipelineProps) {
  return (
    <div className="pipeline">
      {tests.map((test, index) => (
        <div className="pipeline__step" key={test.id}>
          <button
            type="button"
            className={`pipeline__node pipeline__node--${test.status.toLowerCase()} ${
              test.id === selectedId ? 'pipeline__node--selected' : ''
            }`}
            onClick={() => onSelect(test.id)}
            title={test.name}
          >
            <span className="pipeline__node-icon" aria-hidden="true" />
          </button>
          <div className="pipeline__label">{test.name}</div>
          <StatusBadge status={test.status} />
          {index < tests.length - 1 && <div className="pipeline__connector" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
