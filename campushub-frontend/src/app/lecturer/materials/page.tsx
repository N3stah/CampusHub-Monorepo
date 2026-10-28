'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit, CourseResource } from '@/types/portal';

interface UnitMaterial extends CourseResource {
  offeringId: number;
  unitCode: string;
  unitTitle: string;
}

export default function LecturerMaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<UnitMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMaterials = useCallback(async (signal?: AbortSignal) => {
    try {
      const unitsPage = await getApiPage<AcademicUnit>('/academics/units/', {}, signal);
      const assigned = unitsPage.results.flatMap((unit) => unit.offerings
        .filter((offering) => offering.lecturers.some((lecturer) => lecturer.id === user?.id))
        .map((offering) => ({ unit, offeringId: offering.offering_id })));
      const results = await Promise.all(assigned.map(async ({ unit, offeringId }) => {
        const page = await getApiPage<CourseResource>(`/resources/offerings/${offeringId}/resources/`, {}, signal);
        return page.results.map((resource) => ({
          ...resource,
          offeringId,
          unitCode: unit.code,
          unitTitle: unit.title,
        }));
      }));
      if (signal?.aborted) return;
      setMaterials(results.flat().sort((left, right) => (
        new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()
      )));
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadMaterials(controller.signal));
    return () => controller.abort();
  }, [loadMaterials]);

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Teaching resources</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Learning materials / notes</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Materials across your assigned units. Upload notes or topic resources from the unit page.</p>
        </header>
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading materials…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p role="alert" className="text-sm text-red-800">{error}</p><button type="button" onClick={() => { setLoading(true); void loadMaterials(); }} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button></div>
        ) : materials.length ? (
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {materials.map((material) => (
              <li key={`${material.offeringId}-${material.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{material.unitCode} · {material.category ?? 'Resource'}</p>
                  <h2 className="mt-1 font-semibold">{material.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{material.unitTitle}{material.description ? ` · ${material.description}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  {material.file_url && <a href={material.file_url} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Open file</a>}
                  <Link href={`/lecturer/units/${material.offeringId}#materials`} className="text-sm font-semibold text-blue-700 hover:underline">Manage unit</Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-semibold">No learning materials yet</p>
            <p className="mt-1 text-sm text-slate-500">Open a unit to upload notes or topic resources for its students.</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
