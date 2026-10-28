'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import type { FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { DownloadResourceButton } from '@/components/MyCourses';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { ClassSession, Course, CourseAnnouncement, CourseResource, CourseRosterEntry, UnitAssignment, UnitGroupSet } from '@/types/portal';

const allowedResourceExtensions = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg']);
const maxResourceSize = 10 * 1024 * 1024;

function StudentUnitPanel({
  offeringId,
}: {
  offeringId: number;
}) {
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [assignments, setAssignments] = useState<UnitAssignment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [groupSet, setGroupSet] = useState<UnitGroupSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getApiPage<CourseResource>(`/resources/offerings/${offeringId}/resources/`, {}, controller.signal),
      getApiPage<CourseAnnouncement>(`/resources/offerings/${offeringId}/announcements/`, {}, controller.signal),
      getApiPage<UnitAssignment>(`/academics/offerings/${offeringId}/assignments/`, {}, controller.signal),
      getApiPage<ClassSession>(`/academics/offerings/${offeringId}/sessions/`, {}, controller.signal),
      api.get<UnitGroupSet | null>(`/academics/offerings/${offeringId}/groups/`, { signal: controller.signal }),
    ]).then(([resourcePage, announcementPage, assignmentPage, sessionPage, groupResponse]) => {
      if (controller.signal.aborted) return;
      setResources(resourcePage.results);
      setAnnouncements(announcementPage.results);
      setAssignments(assignmentPage.results);
      setSessions(sessionPage.results);
      setGroupSet(groupResponse.data);
      setError(null);
    }).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(requestError));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [offeringId]);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  if (loading) return <p role="status" className="mt-4 text-sm text-slate-500">Loading unit activities…</p>;
  if (error) return <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>;

  return (
    <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
      {sessions.length > 0 && (
        <section aria-label="Class schedule">
          <h3 className="text-sm font-semibold">Class schedule</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sessions.map((session) => <li key={session.id} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">{session.day_name} · {session.start_time}–{session.end_time}{session.location ? ` · ${session.location}` : ''}</li>)}
          </ul>
        </section>
      )}
      {groupSet?.groups.map((group) => (
        <section key={group.id} aria-label={`Your group ${group.name}`}>
          <h3 className="text-sm font-semibold">Your group: {group.name}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {group.students.map((student) => <li key={student.id} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">{student.name}</li>)}
          </ul>
        </section>
      ))}
      {assignments.length > 0 && (
        <section aria-label="Unit assignments">
          <h3 className="text-sm font-semibold">Assignments</h3>
          <ul className="mt-2 space-y-2">
            {assignments.map((assignment) => {
              const remaining = new Date(assignment.due_at).getTime() - now;
              const dueLabel = remaining <= 0
                ? 'Past due'
                : `${Math.floor(remaining / 86_400_000)} days remaining`;
              return (
                <li key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-semibold">{assignment.title}</p>
                    <p className="text-xs font-semibold text-amber-800">{dueLabel}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Due {new Date(assignment.due_at).toLocaleString()} · {assignment.max_points} points</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{assignment.instructions}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {announcements.length > 0 && (
        <section aria-label="Unit announcements">
          <h3 className="text-sm font-semibold">Unit announcements</h3>
          <ul className="mt-2 space-y-2">
            {announcements.map((announcement) => <li key={announcement.id} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-sm font-semibold">{announcement.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{announcement.body}</p></li>)}
          </ul>
        </section>
      )}
      {resources.length > 0 && (
        <section aria-label="Unit learning materials">
          <h3 className="text-sm font-semibold">Learning materials and notes</h3>
          <ul className="mt-2 space-y-2">
            {resources.map((resource) => <li key={resource.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"><div><p className="text-xs font-semibold uppercase text-blue-700">{resource.category ?? 'Resource'}</p><p className="mt-1 text-sm font-medium">{resource.title}</p><p className="mt-1 text-xs text-slate-500">{resource.description}</p></div>{resource.file_url && <a href={resource.file_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:underline">Open file</a>}</li>)}
          </ul>
        </section>
      )}
      {!sessions.length && !assignments.length && !announcements.length && !resources.length && !groupSet?.groups.length && <p className="text-sm text-slate-500">No unit activities have been posted yet.</p>}
    </div>
  );
}

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
  const { user } = useAuth();
  const courseId = params.id;
  const [course, setCourse] = useState<Course | null>(null);
  const [roster, setRoster] = useState<CourseRosterEntry[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceFormError, setResourceFormError] = useState<string | null>(null);
  const [resourceNotice, setResourceNotice] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null);
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementFormError, setAnnouncementFormError] = useState<string | null>(null);
  const [announcementNotice, setAnnouncementNotice] = useState<string | null>(null);
  const canManageCourse = user?.role === 'admin' || (
    user?.role === 'lecturer' && (
      !!course?.lecturer_ids?.includes(user.id) || course?.lecturer_id === user.id
    )
  );
  const canViewRoster = canManageCourse;
  const filteredRoster = roster.filter((entry) => (
    `${entry.admission_number ?? ''} ${entry.student_name}`.toLocaleLowerCase().includes(rosterSearch.trim().toLocaleLowerCase())
  ));

  const loadCourse = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<Course>(`/academics/courses/${courseId}/`, { signal });
      setCourse(response.data);
      setCourseError(null);
    } catch (requestError) {
      if (!signal?.aborted) setCourseError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setCourseLoading(false);
    }
  }, [courseId]);

  const loadResources = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getApiPage<CourseResource>(`/resources/courses/${courseId}/resources/`, {}, signal);
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
      const result = await getApiPage<CourseAnnouncement>(`/resources/courses/${courseId}/announcements/`, {}, signal);
      setAnnouncements(result.results);
      setAnnouncementsError(null);
    } catch (requestError) {
      if (!signal?.aborted) setAnnouncementsError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setAnnouncementsLoading(false);
    }
  }, [courseId]);

  const loadRoster = useCallback(async (signal?: AbortSignal) => {
    setRosterLoading(true);
    try {
      const response = await getApiPage<CourseRosterEntry>(`/academics/courses/${courseId}/roster/`, {}, signal);
      setRoster(response.results);
      setRosterError(null);
    } catch (requestError) {
      if (!signal?.aborted) setRosterError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setRosterLoading(false);
    }
  }, [courseId]);

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!resourceTitle.trim()) {
      setResourceFormError('Enter a resource title.');
      return;
    }
    if (!resourceFile && editingResourceId === null) {
      setResourceFormError('Choose a file to upload.');
      return;
    }

    if (resourceFile) {
      const extension = resourceFile.name.split('.').pop()?.toLowerCase() ?? '';
      if (!allowedResourceExtensions.has(extension)) {
        setResourceFormError('Allowed file types: PDF, DOCX, PPTX, XLSX, PNG, and JPG.');
        return;
      }
      if (resourceFile.size > maxResourceSize) {
        setResourceFormError('Files must be 10 MB or smaller.');
        return;
      }
    }

    setUploadingResource(true);
    setResourceFormError(null);
    setResourceNotice(null);
    try {
      const formData = new FormData();
      formData.append('title', resourceTitle.trim());
      formData.append('description', resourceDescription.trim());
      if (resourceFile) formData.append('file', resourceFile);
      const resourceEndpoint = `/resources/courses/${courseId}/resources/`;
      if (editingResourceId !== null) {
        await api.patch(`${resourceEndpoint}${editingResourceId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(resourceEndpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setResourceTitle('');
      setResourceDescription('');
      setResourceFile(null);
      setEditingResourceId(null);
      form.reset();
      setResourceNotice(editingResourceId !== null ? 'Resource updated.' : 'Resource uploaded successfully.');
      await loadResources();
    } catch (requestError) {
      setResourceFormError(getApiErrorMessage(requestError));
    } finally {
      setUploadingResource(false);
    }
  }

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      setAnnouncementFormError('Enter both an announcement title and message.');
      return;
    }
    setPublishingAnnouncement(true);
    setAnnouncementFormError(null);
    setAnnouncementNotice(null);
    try {
      const announcementPayload = {
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
      };
      const announcementEndpoint = `/resources/courses/${courseId}/announcements/`;
      if (editingAnnouncementId !== null) {
        await api.patch(`${announcementEndpoint}${editingAnnouncementId}/`, announcementPayload);
      } else {
        await api.post(announcementEndpoint, announcementPayload);
      }
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setEditingAnnouncementId(null);
      setAnnouncementNotice(editingAnnouncementId !== null ? 'Announcement updated.' : 'Announcement posted successfully.');
      await loadAnnouncements();
    } catch (requestError) {
      setAnnouncementFormError(getApiErrorMessage(requestError));
    } finally {
      setPublishingAnnouncement(false);
    }
  }

  function editResource(resource: CourseResource) {
    setEditingResourceId(resource.id);
    setResourceTitle(resource.title);
    setResourceDescription(resource.description ?? '');
    setResourceFile(null);
    setResourceFormError(null);
    setResourceNotice(null);
  }

  async function deleteResource(resource: CourseResource) {
    if (!window.confirm(`Delete resource "${resource.title}"?`)) return;
    setResourceFormError(null);
    try {
      await api.delete(`/resources/courses/${courseId}/resources/${resource.id}/`);
      setResourceNotice('Resource deleted.');
      await loadResources();
    } catch (requestError) {
      setResourceFormError(getApiErrorMessage(requestError));
    }
  }

  function editAnnouncement(announcement: CourseAnnouncement) {
    setEditingAnnouncementId(announcement.id);
    setAnnouncementTitle(announcement.title);
    setAnnouncementBody(announcement.body);
    setAnnouncementFormError(null);
    setAnnouncementNotice(null);
  }

  async function deleteAnnouncement(announcement: CourseAnnouncement) {
    if (!window.confirm(`Delete announcement "${announcement.title}"?`)) return;
    setAnnouncementFormError(null);
    try {
      await api.delete(`/resources/courses/${courseId}/announcements/${announcement.id}/`);
      setAnnouncementNotice('Announcement deleted.');
      await loadAnnouncements();
    } catch (requestError) {
      setAnnouncementFormError(getApiErrorMessage(requestError));
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadCourse(controller.signal);
      void loadResources(controller.signal);
      void loadAnnouncements(controller.signal);
    });
    return () => controller.abort();
  }, [loadCourse, loadResources, loadAnnouncements]);

  useEffect(() => {
    if (!canViewRoster) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => loadRoster(controller.signal));
    return () => controller.abort();
  }, [canViewRoster, loadRoster]);

  return (
    <PortalShell roles={['student', 'lecturer', 'admin']}>
      <section className="space-y-6">
      <Link
        href={user?.role === 'lecturer' ? '/dashboard' : user?.role === 'admin' ? '/admin/courses' : '/courses'}
        className="text-sm font-semibold text-blue-700 hover:underline"
      >
        {user?.role === 'lecturer' ? '← Back to teaching dashboard' : user?.role === 'admin' ? '← Back to course management' : '← Back to my courses'}
      </Link>
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
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-800">{course.school_name} · {course.department_name}</span>
              </div>
              {courseError && <p role="status" className="mt-3 text-xs text-amber-700">Course data loaded, but additional lecturer details are unavailable: {courseError}</p>}
            </header>

            {!!course.units?.length && (
              <section aria-labelledby="programme-units-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 id="programme-units-heading" className="font-semibold">Course units</h2>
                  <p className="mt-1 text-xs text-slate-500">Open a unit to view its schedule, assignments, learning materials, and updates.</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {course.units.map((unit) => (
                    <li id={`unit-${unit.id}`} key={unit.id} className="px-5 py-4">
                      {user?.role === 'student' ? (
                        <details className="group">
                          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{unit.code}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{unit.title}</p>
                            </div>
                            <span className="text-sm text-slate-600">{unit.lecturers.map((assigned) => assigned.name).join(', ') || 'Lecturer not assigned'}</span>
                            <span className="text-sm font-semibold text-blue-700 group-open:hidden">View unit ↓</span>
                            <span className="hidden text-sm font-semibold text-blue-700 group-open:inline">Close unit ↑</span>
                          </summary>
                          {unit.offering_id !== undefined && <StudentUnitPanel offeringId={unit.offering_id} />}
                        </details>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{unit.code}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{unit.title}</p>
                          </div>
                          <p className="text-sm text-slate-600">{unit.lecturers.map((assigned) => assigned.name).join(', ') || 'Lecturer not assigned'}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {canViewRoster && (
              <section aria-labelledby="course-roster-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 id="course-roster-heading" className="font-semibold">Enrolled students</h2>
                    <p className="mt-1 text-xs text-slate-500">Student roster for this course</p>
                  </div>
                  {!rosterLoading && !rosterError && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{roster.length}</span>}
                </div>
                {!rosterLoading && !rosterError && roster.length > 0 && (
                  <div className="border-b border-slate-100 p-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Find student by admission number
                      <input
                        type="search"
                        value={rosterSearch}
                        onChange={(event) => setRosterSearch(event.target.value)}
                        placeholder="e.g. 23/08181"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:max-w-sm"
                      />
                    </label>
                  </div>
                )}
                {rosterError && (
                  <div role="alert" className="flex flex-col gap-2 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
                    <p>{rosterError}</p>
                    <button type="button" onClick={() => { setRosterLoading(true); void loadRoster(); }} className="self-start font-semibold underline">Retry</button>
                  </div>
                )}
                {rosterLoading ? (
                  <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading enrolled students…</p>
                ) : rosterError ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-500">The roster could not be loaded.</p>
                ) : filteredRoster.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="px-5 py-3 font-semibold">Student</th>
                          <th scope="col" className="px-5 py-3 font-semibold">Admission number</th>
                          <th scope="col" className="px-5 py-3 font-semibold">Email</th>
                          <th scope="col" className="px-5 py-3 font-semibold">Enrollment status</th>
                          <th scope="col" className="px-5 py-3 font-semibold">Enrolled</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRoster.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-5 py-3 font-medium">{entry.student_name}</td>
                            <td className="px-5 py-3 font-medium text-slate-700">{entry.admission_number ?? '—'}</td>
                            <td className="px-5 py-3 text-slate-600">{entry.student_email}</td>
                            <td className="px-5 py-3 capitalize text-slate-600">{entry.status}</td>
                            <td className="px-5 py-3 text-slate-600">{new Date(entry.enrolled_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-slate-500">
                    {roster.length ? 'No students match that admission number or name.' : 'No students are enrolled in this course yet.'}
                  </p>
                )}
              </section>
            )}

            {canManageCourse && (
              <section aria-label="Course teaching tools" className="grid gap-4 xl:grid-cols-2">
                <form onSubmit={uploadResource} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <h2 className="font-semibold">{editingResourceId !== null ? 'Edit course resource' : 'Upload a course resource'}</h2>
                    <p className="mt-1 text-xs text-slate-500">PDF, DOCX, PPTX, XLSX, PNG, or JPG up to 10 MB. When editing, choosing a file replaces the current one.</p>
                  </div>
                  {resourceNotice && <p role="status" className="text-sm text-emerald-700">{resourceNotice}</p>}
                  {resourceFormError && <p role="alert" className="text-sm text-red-700">{resourceFormError}</p>}
                  <label className="block text-sm font-medium text-slate-700">
                    Title
                    <input
                      required
                      maxLength={200}
                      value={resourceTitle}
                      onChange={(event) => setResourceTitle(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Description <span className="font-normal text-slate-500">(optional)</span>
                    <textarea
                      value={resourceDescription}
                      onChange={(event) => setResourceDescription(event.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    File {editingResourceId !== null && <span className="font-normal text-slate-500">(optional when editing)</span>}
                    <input
                      required={editingResourceId === null}
                      type="file"
                      accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg"
                      onChange={(event) => setResourceFile(event.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={uploadingResource}
                    className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {uploadingResource ? 'Saving…' : editingResourceId !== null ? 'Save resource' : 'Upload resource'}
                  </button>
                  {editingResourceId !== null && (
                    <button type="button" onClick={() => { setEditingResourceId(null); setResourceTitle(''); setResourceDescription(''); setResourceFile(null); setResourceFormError(null); }} className="ml-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold">
                      Cancel edit
                    </button>
                  )}
                </form>

                <form onSubmit={publishAnnouncement} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <h2 className="font-semibold">{editingAnnouncementId !== null ? 'Edit course announcement' : 'Post a course announcement'}</h2>
                    <p className="mt-1 text-xs text-slate-500">Visible to students enrolled in this course.</p>
                  </div>
                  {announcementNotice && <p role="status" className="text-sm text-emerald-700">{announcementNotice}</p>}
                  {announcementFormError && <p role="alert" className="text-sm text-red-700">{announcementFormError}</p>}
                  <label className="block text-sm font-medium text-slate-700">
                    Title
                    <input
                      required
                      maxLength={200}
                      value={announcementTitle}
                      onChange={(event) => setAnnouncementTitle(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Announcement
                    <textarea
                      required
                      value={announcementBody}
                      onChange={(event) => setAnnouncementBody(event.target.value)}
                      rows={5}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={publishingAnnouncement}
                    className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {publishingAnnouncement ? 'Saving…' : editingAnnouncementId !== null ? 'Save announcement' : 'Post announcement'}
                  </button>
                  {editingAnnouncementId !== null && (
                    <button type="button" onClick={() => { setEditingAnnouncementId(null); setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementFormError(null); }} className="ml-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold">
                      Cancel edit
                    </button>
                  )}
                </form>
              </section>
            )}

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
                          {[resource.file_type?.toUpperCase(), resource.uploaded_by, resource.created_at && new Date(resource.created_at).toLocaleDateString()].filter(Boolean).join(' · ') || 'Course file'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageCourse && (
                          <>
                            <button type="button" onClick={() => editResource(resource)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                            <button type="button" onClick={() => void deleteResource(resource)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>
                          </>
                        )}
                        <DownloadResourceButton courseId={Number(courseId)} resourceId={resource.id} resourceTitle={resource.title} />
                      </div>
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
                        {[announcement.author, announcement.created_at && new Date(announcement.created_at).toLocaleString()].filter(Boolean).join(' · ')}
                      </p>
                      {canManageCourse && (
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => editAnnouncement(announcement)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                          <button type="button" onClick={() => void deleteAnnouncement(announcement)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>
                        </div>
                      )}
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
