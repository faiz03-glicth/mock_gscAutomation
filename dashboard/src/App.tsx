import { useCallback, useEffect, useRef, useState } from 'react';
import Pipeline from './components/Pipeline';
import ResultsLog from './components/ResultsLog';
import TestCaseCard from './components/TestCaseCard';
import { fetchTests, runAllTests, runTest } from './services/api';
import { TestExecution } from './types/test';

const POLL_INTERVAL_MS = 1_500;

export default function App() {
  const [tests, setTests] = useState<TestExecution[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runAllInFlight, setRunAllInFlight] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const latest = await fetchTests();
      setTests(latest);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Poll GET /api/tests on a fixed interval - this is the whole live-update
  // mechanism (no WebSockets), matching the spec's "1-2s polling" requirement.
  useEffect(() => {
    refresh();
    pollTimer.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [refresh]);

  const anyRunning = tests.some((t) => t.status === 'RUNNING') || runAllInFlight;

  const handleRun = useCallback(
    async (id: string) => {
      try {
        setErrorMessage(null);
        await runTest(id);
        await refresh();
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [refresh]
  );

  const handleRunAll = useCallback(async () => {
    try {
      setErrorMessage(null);
      setRunAllInFlight(true);
      await runAllTests();
      // Run-all runs sequentially on the backend; polling picks up progress
      // automatically, but a short delay lets the first test's RUNNING
      // state land before the next poll tick.
      setTimeout(() => setRunAllInFlight(false), POLL_INTERVAL_MS);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setRunAllInFlight(false);
    }
  }, []);

  // Selecting a test (via its pipeline node or card) doesn't hide the
  // others - every test's result is always listed in ResultsLog below. It
  // only highlights that test's entry and scrolls it into view.
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`result-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>GSC Automation Dashboard</h1>
        <button type="button" className="app__run-all-button" disabled={anyRunning} onClick={handleRunAll}>
          {anyRunning ? 'Running…' : 'Run All Tests'}
        </button>
      </header>

      {errorMessage && <div className="app__error">{errorMessage}</div>}

      <Pipeline tests={tests} selectedId={selectedId} onSelect={handleSelect} />

      <div className="app__cards">
        {tests.map((test) => (
          <TestCaseCard
            key={test.id}
            test={test}
            disabled={anyRunning}
            selected={test.id === selectedId}
            onSelect={handleSelect}
            onRun={handleRun}
          />
        ))}
      </div>

      <ResultsLog tests={tests} selectedId={selectedId} />
    </div>
  );
}
