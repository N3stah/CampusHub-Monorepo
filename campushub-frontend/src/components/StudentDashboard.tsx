'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { CourseAnnouncement, Enrollment, Placement, StudentApplication } from '@/types/portal';

interface StudentAnnouncement extends CourseAnnouncement {
  course_code: string;
  course_title: string;
}

const applicationStatusStyle: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  shortlisted: 'bg-blue-50 text-blue-800',
  accepted: 'bg-emerald-50 text-emerald-800',
  approved: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
};

export default function StudentDashboard() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingPlacements, setLoadingPlacements] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(true);

  const loadCoursesAndUpdates = useCallback(async (signal?: AbortSignal) => {
    try {
      const enrollmentPage = await getApiPage<Enrollment>('/academics/enrollments/', {}, signal);
      const activeCourses = enrollmentPage.results.filter((enrollment) => enrollment.status === 'active');
      setEnrollments(enrollmentPage.results);
      setCourseError(null);
      setLoadingCourses(false);

      const updateResults = await Promise.allSettled(
        activeCourses.map(async (enrollment) => {
          const page = await getApiPage<CourseAnnouncement>(
            `/courses/${enrollment.course_id}/announcements/`,
            {},
            signal,
          );
          return page.results.map((announcement) => ({
            ...announcement,
            course_code: enrollment.course_code,
            course_title: enrollment.course_title,
          }));
        }),
      );

      if (signal?.aborted) return;
      const updates = updateResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
      updates.sort((left, right) => {
        if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
        return new Date(right.published_at).getTime() - new Date(left.published_at).getTime();
      });
      setAnnouncements(updates.slice(0, 5));
      const failedRequests = updateResults.some((result) => result.status === 'rejected');
      setUpdatesError(failedRequests ? 'Some course updates could not be loaded.' : null);
    } catch (requestError) {
      if (!signal?.aborted) {
        setCourseError(getApiErrorMessage(requestError));
        setUpdatesError(getApiErrorMessage(requestError));
      }
    } finally {
      if (!signal?.aborted) setLoadingCourses(false);
    }
  }, []);

  const loadPlacements = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await getApiPage<Placement>('/placements/', { is_active: 'true' }, signal);
      setPlacements(page.results.slice(0, 3));
      setPlacementsError(null);
    } catch (requestError) {
      if (!signal?.aborted) setPlacementsError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoadingPlacements(false);
    }
  }, []);

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await getApiPage<StudentApplication>('/applications/', {}, signal);
      setApplications(page.results);
      setApplicationsError(null);
    } catch (requestError) {
      if (!signal?.aborted) setApplicationsError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoadingApplications(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadCoursesAndUpdates(controller.signal);
      void loadPlacements(controller.signal);
      void loadApplications(controller.signal);
    });
    return () => controller.abort();
  }, [loadCoursesAndUpdates, loadPlacements, loadApplications]);

  const activeCourses = enrollments.filter((enrollment) => enrollment.status === 'active');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Student portal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Your learning at a glance</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Courses, lecturer announcements, resources, and your internship applications in one place.</p>
      </div>

      <section aria-label="Student summary" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Active courses', value: loadingCourses ? null : activeCourses.length, href: '/courses' },
          { label: 'Applications', value: loadingApplications ? null : applications.length, href: '/placements' },
          { label: 'New opportunities', value: loadingPlacements ? null : placements.length, href: '/placements' },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-bold">{item.value ?? <span className="text-lg text-slate-400">Loading…</span>}</p>
            <p className="mt-1 text-xs font-semibold text-blue-700">View details →</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="student-courses-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="student-courses-heading" className="font-semibold">My courses</h2>
              <p className="mt-1 text-xs text-slate-500">Open a course for resources and lecturer details</p>
            </div>
            <Link href="/courses" className="text-sm font-semibold text-blue-700 hover:underline">All courses</Link>
          </div>
          {loadingCourses ? (
            <p role="status" className="p-6 text-center text-sm text-slate-500">Loading your courses…</p>
          ) : courseError ? (
            <div className="p-5">
              <p role="alert" className="text-sm text-red-700">{courseError}</p>
              <button type="button" onClick={() => { setLoadingCourses(true); setCourseError(null); void loadCoursesAndUpdates(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
            </div>
          ) : activeCourses.length ? (
            <ul className="divide-y divide-slate-100">
              {activeCourses.slice(0, 4).map((enrollment) => (
                <li key={enrollment.id}>
                  <Link href={`/courses/${enrollment.course_id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{enrollment.course_code}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{enrollment.course_title}</p>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">You do not have any active courses yet.</p>
          )}
        </section>

        <section aria-labelledby="lecturer-updates-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="lecturer-updates-heading" className="font-semibold">Lecturer updates</h2>
            <p className="mt-1 text-xs text-slate-500">Recent announcements from your courses</p>
          </div>
          {loadingCourses ? (
            <p role="status" className="p-6 text-center text-sm text-slate-500">Loading updates…</p>
          ) : updatesError ? (
            <div className="p-5">
              <p role="alert" className="text-sm text-red-700">{updatesError}</p>
              <button type="button" onClick={() => { setLoadingCourses(true); setUpdatesError(null); void loadCoursesAndUpdates(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
            </div>
          ) : announcements.length ? (
            <ul className="divide-y divide-slate-100">
              {announcements.map((announcement) => (
                <li key={`${announcement.id}-${announcement.course_code}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{announcement.title}</p>
                    {announcement.is_pinned && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Pinned</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{announcement.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {announcement.course_code} · {announcement.published_at ? new Date(announcement.published_at).toLocaleString() : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">No lecturer updates yet.</p>
          )}
        </section>

        <section aria-labelledby="internships-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="internships-heading" className="font-semibold">Internships & placements</h2>
              <p className="mt-1 text-xs text-slate-500">Open opportunities to explore</p>
            </div>
            <Link href="/placements" className="text-sm font-semibold text-blue-700 hover:underline">Browse all</Link>
          </div>
          {loadingPlacements ? (
            <p role="status" className="p-6 text-center text-sm text-slate-500">Loading opportunities…</p>
          ) : placementsError ? (
            <div className="p-5">
              <p role="alert" className="text-sm text-red-700">{placementsError}</p>
              <button type="button" onClick={() => { setLoadingPlacements(true); setPlacementsError(null); void loadPlacements(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
            </div>
          ) : placements.length ? (
            <ul className="divide-y divide-slate-100">
              {placements.map((placement) => (
                <li key={placement.id} className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{placement.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{placement.company} · {placement.is_remote ? 'Remote' : placement.location}</p>
                  <p className="mt-1 text-xs text-slate-500">Deadline: {placement.deadline ? new Date(placement.deadline).toLocaleDateString() : 'Not specified'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">No open placements are available right now.</p>
          )}
        </section>

        <section aria-labelledby="applications-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="applications-heading" className="font-semibold">My applications</h2>
              <p className="mt-1 text-xs text-slate-500">Track review and decision status</p>
            </div>
            <Link href="/placements" className="text-sm font-semibold text-blue-700 hover:underline">Find placements</Link>
          </div>
          {loadingApplications ? (
            <p role="status" className="p-6 text-center text-sm text-slate-500">Loading applications…</p>
          ) : applicationsError ? (
            <div className="p-5">
              <p role="alert" className="text-sm text-red-700">{applicationsError}</p>
              <button type="button" onClick={() => { setLoadingApplications(true); setApplicationsError(null); void loadApplications(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
            </div>
          ) : applications.length ? (
            <ul className="divide-y divide-slate-100">
              {applications.map((application) => (
                <li key={application.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{application.placement?.title ?? application.placement_title ?? 'Placement application'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {application.placement?.company ?? application.company ?? ''}
                      {application.applied_at ? ` · Applied ${new Date(application.applied_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${applicationStatusStyle[application.status] ?? 'bg-slate-100 text-slate-700'}`}>
                    {application.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">You have not applied to any placements yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
