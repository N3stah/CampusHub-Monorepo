'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Placement, StudentApplication } from '@/types/portal';

const applicationStatuses = ['pending', 'shortlisted', 'accepted', 'rejected'] as const;

export default function PlacementOverview() {
  const { user } = useAuth();
  const [placementCount, setPlacementCount] = useState<number | null>(null);
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      const placementPage = await getApiPage<Placement>('/placements/', {}, signal);
      const visiblePlacements = user.role === 'officer'
        ? placementPage.results.filter((placement) => placement.posted_by?.id === user.id)
        : placementPage.results;

      if (user.role === 'admin' || user.role === 'officer') {
        const applicationPage = await getApiPage<StudentApplication>('/applications/', {}, signal);
        setApplications(applicationPage.results);
      }

      setPlacementCount(visiblePlacements.length);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadOverview(controller.signal));
    return () => controller.abort();
  }, [loadOverview]);

  const cards = [
    { label: 'Active placements', value: placementCount, hint: 'Accepting applications' },
    ...(user?.role === 'admin' || user?.role === 'officer'
      ? [
          {
            label: 'Total applications',
            value: applications.length,
            hint: user.role === 'officer' ? 'For your placement listings' : 'Across all placement listings',
          },
          ...applicationStatuses.map((status) => ({
            label: `${status[0].toUpperCase()}${status.slice(1)} applications`,
            value: applications.filter((application) => application.status === status).length,
            hint: status === 'pending' ? 'Awaiting review' : `Marked ${status}`,
          })),
        ]
      : []),
  ];

  return (
    <section aria-labelledby="placement-overview-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="placement-overview-heading" className="font-semibold">Placement overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            {user?.role === 'officer' ? 'Your active listings and their application outcomes.' : 'Active opportunities and application outcomes.'}
          </p>
        </div>
        {error && (
          <button
            type="button"
            onClick={() => { setLoading(true); setError(null); void loadOverview(); }}
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            Retry
          </button>
        )}
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.label.toLowerCase().includes('application') ? '/applications' : '/placements'}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {loading
                ? <span className="text-lg font-medium text-slate-400">Loading…</span>
                : error ? '—' : card.value ?? '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
