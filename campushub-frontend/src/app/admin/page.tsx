'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AdminStats, ApiPage } from '@/types/portal';

interface AuditLog {
  id: number;
  action: string;
  actor?: string;
  description?: string;
  created_at: string;
}

const statCards: { key: keyof AdminStats; label: string; hint: string }[] = [
  { key: 'active_users', label: 'Active users', hint: 'Active accounts' },
  { key: 'lecturers', label: 'Lecturers', hint: 'Teaching staff' },
  { key: 'open_placements', label: 'Open placements', hint: 'Accepting applications' },
  { key: 'pending_applications', label: 'Pending applications', hint: 'Awaiting review' },
];

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ApiPage<AuditLog> | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<AdminStats>('/admin/stats/', { signal });
      setStats(response.data);
      setStatsError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setStatsError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setLoadingStats(false);
    }
  }, []);

  const loadLogs = useCallback(async (signal?: AbortSignal) => {
    try {
      setLogs(await getApiPage<AuditLog>('/admin/logs/', { page: 1 }, signal));
      setLogsError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setLogsError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadStats(controller.signal);
      void loadLogs(controller.signal);
    });
    return () => controller.abort();
  }, [loadStats, loadLogs]);

  return (
    <PortalShell roles={['admin']}>
      <section className="space-y-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CampusHub</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Administration</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Monitor the portal and manage access to core areas.</p>
        </div>

        <section aria-labelledby="overview-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="overview-heading" className="font-semibold">Overview</h2>
            {statsError && <button type="button" onClick={() => { setLoadingStats(true); setStatsError(null); void loadStats(); }} className="text-sm font-semibold text-blue-700 hover:underline">Retry stats</button>}
          </div>
          {statsError && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{statsError}</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {loadingStats ? <span className="text-lg font-medium text-slate-400">Loading…</span> : stats?.[card.key] ?? '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="management-heading">
          <div className="mb-3">
            <h2 id="management-heading" className="font-semibold">Management</h2>
            <p className="mt-1 text-sm text-slate-500">Quick links for the most-used admin tasks.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { title: 'Departments', detail: 'Manage department details, students, lecturers, and courses.', href: '/admin/departments' },
              { title: 'Courses', detail: 'Create and manage courses, and assign lecturers to one or more courses.', href: '/admin/courses' },
              { title: 'Student accounts', detail: 'Review student directory and account status.', href: '/users' },
              { title: 'Lecturer directory', detail: 'Browse lecturer accounts and departments.', href: '/lecturers' },
              { title: 'Placement listings', detail: 'Create and review current opportunities.', href: '/placements' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-5 text-slate-500">{item.detail}</p>
                <p className="mt-4 text-sm font-semibold text-blue-700">Open section →</p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="permissions-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="permissions-heading" className="font-semibold">Role access</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-3 pr-4">Role</th><th className="px-4 py-3">Typical access</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr><th scope="row" className="py-3 pr-4 font-semibold text-slate-800">Student</th><td className="px-4 py-3">Own profile, placements, own applications</td></tr>
                <tr><th scope="row" className="py-3 pr-4 font-semibold text-slate-800">Lecturer</th><td className="px-4 py-3">Lecturer directory, courses, placements</td></tr>
                <tr><th scope="row" className="py-3 pr-4 font-semibold text-slate-800">Placement officer</th><td className="px-4 py-3">Student directory, placement listings</td></tr>
                <tr><th scope="row" className="py-3 pr-4 font-semibold text-slate-800">Admin</th><td className="px-4 py-3">All portal areas and administration</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="audit-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="audit-heading" className="font-semibold">Recent activity</h2>
              <p className="mt-1 text-xs text-slate-500">Latest audit events</p>
            </div>
            {logsError && <button type="button" onClick={() => { setLoadingLogs(true); setLogsError(null); void loadLogs(); }} className="text-sm font-semibold text-blue-700 hover:underline">Retry</button>}
          </div>
          {logsError && <p role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{logsError}</p>}
          {loadingLogs ? (
            <p role="status" className="px-5 py-10 text-center text-sm text-slate-500">Loading recent activity…</p>
          ) : logs?.results.length ? (
            <ul className="divide-y divide-slate-100">
              {logs.results.map((log) => (
                <li key={log.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{log.description || log.action}</p>
                    <p className="mt-1 text-xs text-slate-500">{log.actor || 'System'}</p>
                  </div>
                  <time className="text-xs text-slate-500" dateTime={log.created_at}>
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{logsError ? 'Activity could not be loaded.' : 'No recent activity.'}</p>
          )}
        </section>
      </section>
    </PortalShell>
  );
}
