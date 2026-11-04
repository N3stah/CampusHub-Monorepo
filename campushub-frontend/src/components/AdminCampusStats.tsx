'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import type { AdminStats } from '@/types/portal';

const adminMetrics: { key: keyof AdminStats; label: string; detail: string }[] = [
  { key: 'active_users', label: 'Active users', detail: 'Active platform accounts' },
  { key: 'students', label: 'Students', detail: 'Active student accounts' },
  { key: 'lecturers', label: 'Lecturers', detail: 'Active lecturer accounts' },
  { key: 'placement_officers', label: 'Placement officers', detail: 'Active officer accounts' },
  { key: 'schools', label: 'Schools', detail: 'Academic schools' },
  { key: 'departments', label: 'Departments', detail: 'Academic departments' },
  { key: 'courses', label: 'Programmes', detail: 'Active academic programmes' },
  { key: 'units', label: 'Units', detail: 'Active shared units' },
  { key: 'active_enrollments', label: 'Active admissions', detail: 'Students assigned to programmes' },
  { key: 'placements', label: 'Placements', detail: 'Active opportunities' },
  { key: 'open_placements', label: 'Open placements', detail: 'Open opportunities with upcoming deadlines' },
  { key: 'applications', label: 'Applications', detail: 'Applications received' },
  { key: 'pending_applications', label: 'Pending applications', detail: 'Awaiting review' },
];

export default function AdminCampusStats() {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadAdminStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<AdminStats>('/admin/stats/', { signal });
      setAdminStats(response.data);
      setStatsError(null);
    } catch (error) {
      if (!signal?.aborted) setStatsError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAdminStats(controller.signal));
    return () => controller.abort();
  }, [loadAdminStats]);

  return (
    <section aria-labelledby="admin-stats-heading" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Campus operations</p>
          <h1 id="admin-stats-heading" className="mt-1 text-3xl font-bold tracking-tight">Campus stats</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Current account, academic, and placement activity.</p>
        </div>
        {statsError && (
          <button
            type="button"
            onClick={() => { setStatsLoading(true); void loadAdminStats(); }}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Retry
          </button>
        )}
      </header>
      {statsError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{statsError}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {adminMetrics.map((metric) => (
          <article key={metric.key} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
            <p className="truncate text-xs font-semibold text-slate-600 sm:text-sm">{metric.label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {statsLoading ? <span className="text-sm font-medium text-slate-400">Loading…</span> : adminStats?.[metric.key] ?? '—'}
            </p>
            <p className="mt-0.5 hidden text-[11px] leading-4 text-slate-500 sm:block">{metric.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
