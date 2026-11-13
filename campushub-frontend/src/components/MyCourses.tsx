'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import { downloadBlob, getDownloadFilename } from '@/lib/application-files';
import type { AcademicUnit, Enrollment, UnitRegistration } from '@/types/portal';

interface MyCoursesProps {
  compact?: boolean;
}

export default function MyCourses({ compact = false }: MyCoursesProps) {
  const [units, setUnits] = useState<{
    id: number;
    offering_id: number;
    code: string;
    title: string;
    credits: number;
    course_id: number;
    course_code: string;
    course_title: string;
    lecturers: { id: number; name: string }[];
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async (signal?: AbortSignal) => {
    try {
      const [enrollmentPage, unitPage, registrationPage] = await Promise.all([
        getApiPage<Enrollment>('/academics/enrollments/', {}, signal),
        getApiPage<AcademicUnit>('/academics/units/', {}, signal),
        getApiPage<UnitRegistration>('/academics/registrations/', {}, signal),
      ]);
      const activeCourseIds = new Set(enrollmentPage.results
        .filter((enrollment) => enrollment.status === 'active')
        .map((enrollment) => enrollment.course_id));
      const registeredUnitIds = new Set(registrationPage.results
        .filter((registration) => (
          registration.status === 'registered'
          && registration.academic_period_status === 'active'
        ))
        .map((registration) => registration.unit_id));
      setUnits(unitPage.results.flatMap((unit) => unit.offerings
        .filter((offering) => offering.is_active && activeCourseIds.has(offering.course_id) && registeredUnitIds.has(unit.id))
        .map((offering) => ({
          id: unit.id,
          offering_id: offering.offering_id,
          code: unit.code,
          title: unit.title,
          credits: unit.credits,
          course_id: offering.course_id,
          course_code: offering.course_code,
          course_title: offering.course_title,
          lecturers: offering.lecturers,
        }))));
      setError(null);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadCourses(controller.signal));
    return () => controller.abort();
  }, [loadCourses]);

  return (
    <section aria-labelledby="my-courses-heading" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="my-courses-heading" className="font-semibold">My units</h2>
          <p className="mt-1 text-xs text-slate-500">Units registered for this semester</p>
        </div>
        {units.length > 0 && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{units.length}</span>}
      </div>
      {loading ? (
        <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading your courses…</p>
      ) : error ? (
        <div className="p-5">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); void loadCourses(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
        </div>
      ) : units.length ? (
        <ul className={compact ? 'divide-y divide-slate-100' : 'grid gap-3 p-4 sm:grid-cols-2'}>
          {units.map((unit) => (
            <li key={unit.offering_id}>
              <div className={`${compact ? 'py-4 first:pt-1 last:pb-1' : 'h-full rounded-xl border border-slate-200 p-4'}`}>
                <Link href={`/courses/${unit.course_id}#unit-${unit.id}`} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{unit.code} · {unit.credits} credits</p>
                  <p className="mt-1 font-semibold text-slate-900">{unit.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{unit.course_code} · {unit.course_title}</p>
                  <p className="mt-1 text-xs text-slate-500">{unit.lecturers.map((lecturer) => lecturer.name).join(', ') || 'Lecturer not assigned'}</p>
                  <span className="mt-3 inline-flex text-sm font-semibold text-blue-700">Open unit →</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No units registered for this semester</p>
          <p className="mt-1 text-sm text-slate-500">Your units will appear here after the Registrar registers you.</p>
        </div>
      )}
    </section>
  );
}

export function DownloadResourceButton({ courseId, resourceId, resourceTitle }: { courseId: number; resourceId: number; resourceTitle: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadResource() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<Blob>(
        `/resources/courses/${courseId}/resources/${resourceId}/download/`,
        { responseType: 'blob' },
      );
      downloadBlob(
        response.data,
        getDownloadFilename(response.headers['content-disposition'], resourceTitle),
      );
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void downloadResource()}
        disabled={loading}
        aria-label={`Download ${resourceTitle}`}
        className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {loading ? 'Preparing…' : 'Download'}
      </button>
      {error && <p role="alert" className="mt-2 max-w-xs text-xs text-red-700">{error}</p>}
    </div>
  );
}
