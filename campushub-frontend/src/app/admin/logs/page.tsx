'use client';

import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';

type LogType = 'all' | 'activity' | 'error';

interface AdminLog {
  id: string;
  type: 'activity' | 'error';
  level: string;
  action: string;
  description: string;
  actor: string;
  method: string | null;
  path: string | null;
  exception_type: string | null;
  traceback: string | null;
  created_at: string;
}

interface LogPage {
  count: number;
  next: string | number | null;
  previous: string | number | null;
  results: AdminLog[];
}

const filters: { value: LogType; label: string }[] = [
  { value: 'all', label: 'All logs' },
  { value: 'activity', label: 'Activity' },
  { value: 'error', label: 'Errors' },
];

export default function AdminLogsPage() {
  const [type, setType] = useState<LogType>('all');
  const [pageNumber, setPageNumber] = useState(1);
  const [logs, setLogs] = useState<LogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async (signal?: AbortSignal) => {
    try {
      setLogs(await getApiPage<AdminLog>('/admin/logs/', {
        type,
        page: pageNumber,
        page_size: 25,
      }, signal));
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [pageNumber, type]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadLogs(controller.signal));
    return () => controller.abort();
  }, [loadLogs]);

  return (
    <PortalShell roles={['admin']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">System logs</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Review account and placement activity, plus captured server errors and their diagnostic details.</p>
        </header>

        <section aria-label="Log entries" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex gap-2" aria-label="Filter logs">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={type === filter.value}
                  onClick={() => {
                    setLoading(true);
                    setPageNumber(1);
                    setType(filter.value);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    type === filter.value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {!loading && logs && <span className="text-sm text-slate-500">{logs.count} entries</span>}
          </div>

          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">
              <p>{error}</p>
              <button type="button" onClick={() => { setLoading(true); void loadLogs(); }} className="font-semibold underline">Retry</button>
            </div>
          )}

          {loading ? (
            <p role="status" className="px-5 py-10 text-center text-sm text-slate-500">Loading logs…</p>
          ) : logs?.results.length ? (
            <>
              <ul className="divide-y divide-slate-100">
                {logs.results.map((log) => (
                  <li key={log.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          log.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {log.level}
                        </span>
                        <h2 className="break-all text-sm font-semibold text-slate-900">{log.action}</h2>
                      </div>
                      <time className="shrink-0 text-xs text-slate-500" dateTime={log.created_at}>
                        {new Date(log.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{log.description}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Actor: {log.actor || 'System'}</span>
                      {log.method && <span>Request: {log.method} {log.path}</span>}
                      {log.exception_type && <span>Exception: {log.exception_type}</span>}
                    </div>
                    {log.traceback && (
                      <details className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-red-800">View error details</summary>
                        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{log.traceback}</pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  disabled={!logs.previous || loading}
                  onClick={() => { setLoading(true); setPageNumber((current) => Math.max(1, current - 1)); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">Page {pageNumber}</span>
                <button
                  type="button"
                  disabled={!logs.next || loading}
                  onClick={() => { setLoading(true); setPageNumber((current) => current + 1); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <p role="status" className="px-5 py-10 text-center text-sm text-slate-500">
              {error ? 'Logs could not be loaded.' : 'No log entries found for this filter.'}
            </p>
          )}
        </section>
      </section>
    </PortalShell>
  );
}
