'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit } from '@/types/portal';

export default function LecturerUnitsPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assignedUnits = useMemo(() => units.flatMap((unit) => (
    unit.offerings
      .filter((offering) => offering.lecturers.some((lecturer) => lecturer.id === user?.id))
      .map((offering) => ({ unit, offeringId: offering.offering_id }))
  )), [units, user?.id]);

  const loadUnits = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await getApiPage<AcademicUnit>('/academics/units/', {}, signal);
      setUnits(page.results);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadUnits(controller.signal));
    return () => controller.abort();
  }, [loadUnits]);

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Teaching</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Units</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Only units assigned to your lecturer account are shown here.</p>
        </header>
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading assigned units…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p role="alert" className="text-sm text-red-800">{error}</p>
            <button type="button" onClick={() => { setLoading(true); void loadUnits(); }} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button>
          </div>
        ) : assignedUnits.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assignedUnits.map(({ unit, offeringId }) => (
              <li key={offeringId}>
                <Link href={`/lecturer/units/${offeringId}`} className="block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{unit.code}</p>
                  <h2 className="mt-1 font-semibold text-slate-900">{unit.title}</h2>
                  {unit.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{unit.description}</p>}
                  <span className="mt-4 inline-flex text-sm font-semibold text-blue-700">Manage unit →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-semibold text-slate-800">No units assigned yet</p>
            <p className="mt-1 text-sm text-slate-500">Contact your academic administrator if you expected a unit to appear here.</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
