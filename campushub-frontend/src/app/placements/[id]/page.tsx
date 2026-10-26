'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/portal';
import type { Placement } from '@/types/portal';

export default function PlacementDetailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50"><p role="status" className="text-sm text-slate-500">Loading opportunity…</p></main>}>
      <PlacementDetailContent />
    </Suspense>
  );
}

function PlacementDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlacement = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<Placement>(`/placements/${id}/`, { signal });
      setPlacement(response.data);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadPlacement(controller.signal));
    return () => controller.abort();
  }, [loadPlacement]);

  const canApply = user?.role === 'student' && placement?.is_active && placement.deadline >= new Date().toISOString().slice(0, 10);

  return (
    <PortalShell roles={['student', 'lecturer', 'officer', 'admin']}>
      <section className="mx-auto max-w-4xl space-y-5">
        <Link href="/placements" className="text-sm font-semibold text-blue-700 hover:underline">← Back to placements</Link>
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading opportunity…</p>
        ) : error || !placement ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? 'Placement not found.'}</p>
        ) : (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Placement opportunity</p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight">{placement.title}</h1>
                  <p className="mt-2 text-lg text-slate-600">{placement.company} · {placement.location}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${placement.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {placement.is_active ? 'Open' : 'Closed'}
                </span>
              </div>
              <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Application deadline</dt><dd className="mt-1 text-sm font-medium">{new Date(`${placement.deadline}T00:00:00`).toLocaleDateString()}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available places</dt><dd className="mt-1 text-sm font-medium">{placement.slots_available}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posted by</dt><dd className="mt-1 text-sm font-medium">{placement.posted_by?.name ?? 'Placement office'}</dd></div>
              </dl>
              {canApply && (
                <Link href={`/placements/${placement.id}/apply`} className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                  Apply for this opportunity
                </Link>
              )}
              {user?.role === 'student' && !canApply && (
                <p className="mt-5 text-sm text-slate-500">Applications are closed for this opportunity.</p>
              )}
            </header>
            <section className="grid gap-5 md:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold">About the role</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{placement.description}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold">Requirements</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{placement.requirements}</p>
              </article>
            </section>
          </>
        )}
      </section>
    </PortalShell>
  );
}
