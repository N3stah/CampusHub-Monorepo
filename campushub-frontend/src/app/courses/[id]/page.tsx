'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import PortalShell from '@/components/PortalShell';
import { DownloadResourceButton } from '@/components/MyCourses';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, CourseAnnouncement, CourseResource, LecturerProfile } from '@/types/portal';

export default function CourseDetailPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p role="status" className="text-sm text-slate-500">Loading course…</p>
      </main>
    }>
      <CourseDetailContent />
    </Suspense>
  );
}

function CourseDetailContent() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const [course, setCourse] = useState<Course | null>(null);
  const [lecturer, setLecturer] = useState<LecturerProfile | null>(null);
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  const loadCourse = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<Course>(`/academics/courses/${courseId}/`, { signal });
      setCourse(response.data);
      setCourseError(null);
      if (response.data.lecturer) {
        setLecturer(response.data.lecturer);
      } else if (response.data.lecturer_id) {
        try {
          const lecturerResponse = await api.get<LecturerProfile>(`/lecturers/${response.data.lecturer_id}/`, { signal });
          setLecturer(lecturerResponse.data);
        } catch (requestError) {
          if (!signal?.aborted) setCourseError(getApiErrorMessage(requestError));
        }
      }
    } catch (requestError) {
      if (!signal?.aborted) setCourseError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setCourseLoading(false);
    }
  }, [courseId]);

  const loadResources = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getApiPage<CourseResource>(`/courses/${courseId}/resources/`, {}, signal);
      setResources(result.results);
      setResourcesError(null);
    } catch (requestError) {
      if (!signal?.aborted) setResourcesError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setResourcesLoading(false);
    }
  }, [courseId]);

  const loadAnnouncements = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getApiPage<CourseAnnouncement>(`/courses/${courseId}/announcements/`, {}, signal);
      setAnnouncements(result.results);
      setAnnouncementsError(null);
    } catch (requestError) {
      if (!signal?.aborted) setAnnouncementsError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setAnnouncementsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadCourse(controller.signal);
      void loadResources(controller.signal);
      void loadAnnouncements(controller.signal);
    });
    return () => controller.abort();
  }, [loadCourse, loadResources, loadAnnouncements]);

  return (
    <PortalShell roles={['student']}>
      <section className="space-y-6">
        <Link href="/courses" className="text-sm font-semibold text-blue-700 hover:underline">← Back to my courses</Link>
        {courseLoading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading course…</p>
        ) : courseError && !course ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{courseError}</div>
        ) : course ? (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">{course.code}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{course.title}</h1>
              {course.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{course.description}</p>}
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{course.credits} credits</span>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">
                  {lecturer
                    ? `${lecturer.first_name} ${lecturer.last_name}`
                    : course.lecturer_id
                      ? `Lecturer #${course.lecturer_id}`
                      : 'Lecturer not assigned'}
                </span>
                {lecturer?.email && <a className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-800 hover:underline" href={`mailto:${lecturer.email}`}>{lecturer.email}</a>}
              </div>
              {courseError && <p role="status" className="mt-3 text-xs text-amber-700">Course data loaded, but additional lecturer details are unavailable: {courseError}</p>}
            </header>

            <section aria-labelledby="resources-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 id="resources-heading" className="font-semibold">Course resources</h2>
                <p className="mt-1 text-xs text-slate-500">Notes, slides, and other files shared for this course</p>
              </div>
              {resourcesLoading ? (
                <p role="status" className="p-6 text-center text-sm text-slate-500">Loading resources…</p>
              ) : resourcesError ? (
                <p role="alert" className="p-5 text-sm text-red-700">{resourcesError}</p>
              ) : resources.length ? (
                <ul className="divide-y divide-slate-100">
                  {resources.map((resource) => (
                    <li key={resource.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{resource.title}</p>
                        {resource.description && <p className="mt-1 text-sm text-slate-600">{resource.description}</p>}
                        <p className="mt-1 text-xs text-slate-500">
                          {[resource.file_name, resource.uploaded_by, resource.uploaded_at && new Date(resource.uploaded_at).toLocaleDateString()].filter(Boolean).join(' · ') || 'Course file'}
                        </p>
                      </div>
                      <DownloadResourceButton resourceId={resource.id} resourceTitle={resource.title} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-center text-sm text-slate-500">No resources have been added for this course yet.</p>
              )}
            </section>

            <section aria-labelledby="announcements-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 id="announcements-heading" className="font-semibold">Lecturer updates</h2>
                <p className="mt-1 text-xs text-slate-500">Announcements and updates for this course</p>
              </div>
              {announcementsLoading ? (
                <p role="status" className="p-6 text-center text-sm text-slate-500">Loading lecturer updates…</p>
              ) : announcementsError ? (
                <p role="alert" className="p-5 text-sm text-red-700">{announcementsError}</p>
              ) : announcements.length ? (
                <ul className="divide-y divide-slate-100">
                  {announcements.map((announcement) => (
                    <li key={announcement.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
                        {announcement.is_pinned && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Pinned</span>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.body}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {[announcement.author, announcement.published_at && new Date(announcement.published_at).toLocaleString()].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-center text-sm text-slate-500">No lecturer updates yet.</p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </PortalShell>
  );
}
