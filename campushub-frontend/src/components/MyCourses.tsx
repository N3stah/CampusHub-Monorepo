'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Enrollment } from '@/types/portal';

interface MyCoursesProps {
  compact?: boolean;
}

export default function MyCourses({ compact = false }: MyCoursesProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [droppingId, setDroppingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCourses = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getApiPage<Enrollment>('/academics/enrollments/', {}, signal);
      setEnrollments(result.results);
      setError(null);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  async function dropCourse(enrollment: Enrollment) {
    if (!window.confirm(`Drop ${enrollment.course_code} — ${enrollment.course_title}?`)) return;
    setDroppingId(enrollment.id);
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/academics/enrollments/${enrollment.id}/`);
      setNotice(`${enrollment.course_code} has been dropped.`);
      await loadCourses();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setDroppingId(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadCourses(controller.signal));
    return () => controller.abort();
  }, [loadCourses]);

  const courses = enrollments.filter((enrollment) => enrollment.status === 'active');

  return (
    <section aria-labelledby="my-courses-heading" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="my-courses-heading" className="font-semibold">My courses</h2>
          <p className="mt-1 text-xs text-slate-500">Courses you are currently taking</p>
        </div>
        {notice && <p role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">{notice}</p>}
        {courses.length > 0 && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{courses.length}</span>}
      </div>
      {loading ? (
        <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading your courses…</p>
      ) : error ? (
        <div className="p-5">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); void loadCourses(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
        </div>
      ) : courses.length ? (
        <ul className={compact ? 'divide-y divide-slate-100' : 'grid gap-3 p-4 sm:grid-cols-2'}>
          {courses.map((enrollment) => (
            <li key={enrollment.id}>
              <div className={`flex items-center justify-between gap-3 ${compact ? 'py-4 first:pt-1 last:pb-1' : 'h-full rounded-xl border border-slate-200 p-4'}`}>
                <Link href={`/courses/${enrollment.course_id}`} className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{enrollment.course_code}</p>
                  <p className="mt-1 font-semibold text-slate-900">{enrollment.course_title}</p>
                  <span className="mt-3 inline-flex text-sm font-semibold text-blue-700">Open course →</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void dropCourse(enrollment)}
                  disabled={droppingId !== null}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {droppingId === enrollment.id ? 'Dropping…' : 'Drop'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No active courses yet</p>
          <p className="mt-1 text-sm text-slate-500">Your enrolled courses will appear here.</p>
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
      const response = await api.get<{ file_url?: string | null }>(
        `/resources/courses/${courseId}/resources/${resourceId}/`,
      );
      const fileUrl = response.data.file_url;

      if (!fileUrl) {
        throw new Error('The download response did not include a file URL.');
      }

      const apiRoot = new URL('../', api.defaults.baseURL);
      const downloadUrl = new URL(fileUrl, apiRoot);
      if (
        !['http:', 'https:'].includes(downloadUrl.protocol) ||
        downloadUrl.origin !== apiRoot.origin ||
        downloadUrl.username ||
        downloadUrl.password
      ) {
        throw new Error('The API returned an unsafe download URL.');
      }

      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl.toString();
      downloadLink.target = '_blank';
      downloadLink.rel = 'noopener noreferrer';
      downloadLink.click();
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
