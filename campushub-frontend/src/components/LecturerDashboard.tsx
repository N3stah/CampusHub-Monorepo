'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, LecturerProfile } from '@/types/portal';

export default function LecturerDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      const [profileResponse, coursePage] = await Promise.all([
        api.get<LecturerProfile>(`/lecturers/${user.id}/`, { signal }),
        getApiPage<Course>('/academics/courses/', {}, signal),
      ]);
      if (signal?.aborted) return;
      setProfile(profileResponse.data);
      setCourses(coursePage.results.filter((course) => course.lecturer_id === user.id));
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadDashboard(controller.signal));
    return () => controller.abort();
  }, [loadDashboard]);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Lecturer portal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome, {user?.first_name}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your teaching profile and assigned courses.</p>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setError(null); void loadDashboard(); }}
            className="mt-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section aria-labelledby="teaching-profile-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="teaching-profile-heading" className="text-lg font-semibold">Teaching profile</h2>
            {profile?.title && <p className="mt-1 text-sm text-slate-600">{profile.title}</p>}
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">Lecturer</span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.email ?? user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Office hours</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">{profile?.office_hours || 'Not provided'}</dd>
          </div>
        </dl>
        {profile?.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{profile.bio}</p>}
      </section>

      <section aria-labelledby="assigned-courses-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="assigned-courses-heading" className="font-semibold">Assigned courses</h2>
            <p className="mt-1 text-xs text-slate-500">Courses assigned to your lecturer account</p>
          </div>
          {!loading && !error && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{courses.length}</span>
          )}
        </div>
        {loading ? (
          <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading your courses…</p>
        ) : error ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Courses are unavailable until the request succeeds.</p>
        ) : courses.length ? (
          <ul className="grid gap-3 p-4 sm:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.id}`}
                  className="block h-full rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{course.code}</p>
                  <p className="mt-1 font-semibold text-slate-900">{course.title}</p>
                  <span className="mt-3 inline-flex text-sm font-semibold text-blue-700">Open course →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No courses are currently assigned to your account.</p>
        )}
      </section>
    </section>
  );
}
