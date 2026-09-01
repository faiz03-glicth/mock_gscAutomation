import { TestExecution } from '../types/test';
import TestDetails from './TestDetails';

interface ResultsLogProps {
  tests: TestExecution[];
  selectedId: string | null;
}

/**
 * Every test's full result (status, timestamps, links, logs) stacked in one
 * continuous list, in the fixed pipeline order - rather than requiring a
 * click to reveal one test's details at a time. `selectedId` only controls
 * a highlight + scroll target (see App.tsx), it never hides the others.
 */
export default function ResultsLog({ tests, selectedId }: ResultsLogProps) {
  return (
    <div className="results-log">
      <h2 className="results-log__title">All Results</h2>
      {tests.map((test) => (
        <div
          key={test.id}
          id={`result-${test.id}`}
          className={`results-log__item ${test.id === selectedId ? 'results-log__item--selected' : ''}`}
        >
          <TestDetails test={test} />
        </div>
      ))}
    </div>
  );
}
