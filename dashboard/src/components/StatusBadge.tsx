import { TestStatus } from '../types/test';

const LABELS: Record<TestStatus, string> = {
  NOT_RUN: 'Not Run',
  RUNNING: 'Running',
  PASSED: 'Passed',
  FAILED: 'Failed',
};

/** Small colored pill: gray/blue/green/red for NOT_RUN/RUNNING/PASSED/FAILED. */
export default function StatusBadge({ status }: { status: TestStatus }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
