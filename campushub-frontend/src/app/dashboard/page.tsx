'use client';

import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import LecturerDashboard from '@/components/LecturerDashboard';
import StudentDashboard from '@/components/StudentDashboard';
import PlacementOverview from '@/components/PlacementOverview';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import type { AdminStats } from '@/types/portal';

const adminMetrics: { key: keyof AdminStats; label: string; detail: string }[] = [
  { key: 'students', label: 'Students', detail: 'Active student accounts' },
  { key: 'lecturers', label: 'Lecturers', detail: 'Active lecturer accounts' },
  { key: 'placement_officers', label: 'Placement officers', detail: 'Active officer accounts' },
  { key: 'schools', label: 'Schools', detail: 'Academic schools' },
  { key: 'departments', label: 'Departments', detail: 'Academic departments' },
  { key: 'courses', label: 'Programmes', detail: 'Active academic programmes' },
  { key: 'units', label: 'Units', detail: 'Active shared units' },
  { key: 'active_enrollments', label: 'Active admissions', detail: 'Students assigned to programmes' },
  { key: 'placements', label: 'Placements', detail: 'Active opportunities' },
  { key: 'applications', label: 'Applications', detail: 'Applications received' },
  { key: 'pending_applications', label: 'Pending applications', detail: 'Awaiting review' },
];

export default function DashboardPage() {
  const { user } = useAuth();
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
    if (user?.role !== 'admin') return;
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAdminStats(controller.signal));
    return () => controller.abort();
  }, [loadAdminStats, user?.role]);

  if (user?.role === 'admin') {
    return (
      <PortalShell>
        <section className="space-y-7">
          <header>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CampusHub administration</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome, {user.first_name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Manage campus directories and monitor key account and placement totals.</p>
          </header>

          <section aria-labelledby="admin-totals-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="admin-totals-heading" className="font-semibold">Campus totals</h2>
                <p className="mt-1 text-sm text-slate-500">Current account, academic, and placement activity.</p>
              </div>
              {statsError && (
                <button type="button" onClick={() => { setStatsLoading(true); void loadAdminStats(); }} className="text-sm font-semibold text-blue-700 hover:underline">
                  Retry
                </button>
              )}
            </div>
            {statsError && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{statsError}</p>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {adminMetrics.map((metric) => (
                <article key={metric.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight">
                    {statsLoading ? <span className="text-lg font-medium text-slate-400">Loading…</span> : adminStats?.[metric.key] ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      {user?.role === 'student' ? <StudentDashboard /> : user?.role === 'lecturer' ? <LecturerDashboard /> : (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Your campus, connected</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome, {user?.first_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your CampusHub account and a quick route to the resources you need.</p>
        </div>

        <PlacementOverview />

      </section>
      )}
    </PortalShell>
  );
}
