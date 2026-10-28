'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { CalendarEvent, CourseAnnouncement, Enrollment, Placement, StudentApplication } from '@/types/portal';

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

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthDays(value: Date) {
  const firstDay = startOfMonth(value);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0);
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  const days: Date[] = [];
  for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
    days.push(new Date(date));
  }
  return days;
}

export default function StudentDashboard() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue(new Date()));
  const [courseError, setCourseError] = useState<string | null>(null);
  const [updatesError, setUpdatesError] = useState<string | null>(null);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingPlacements, setLoadingPlacements] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);

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
            `/resources/courses/${enrollment.course_id}/announcements/`,
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
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
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

  const loadCalendar = useCallback(async (signal?: AbortSignal) => {
    const from = dateInputValue(startOfMonth(visibleMonth));
    const to = dateInputValue(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0));
    try {
      const response = await api.get<CalendarEvent[]>('/academics/calendar/', {
        params: { from, to },
        signal,
      });
      setCalendarEvents(response.data);
      setCalendarError(null);
    } catch (requestError) {
      if (!signal?.aborted) setCalendarError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setCalendarLoading(false);
    }
  }, [visibleMonth]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadCoursesAndUpdates(controller.signal);
      void loadPlacements(controller.signal);
      void loadApplications(controller.signal);
    });
    return () => controller.abort();
  }, [loadCoursesAndUpdates, loadPlacements, loadApplications]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadCalendar(controller.signal));
    return () => controller.abort();
  }, [loadCalendar]);

  const activeCourses = enrollments.filter((enrollment) => enrollment.status === 'active');
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of calendarEvents) {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    }
    return grouped;
  }, [calendarEvents]);
  const displayedDays = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const selectedDayEvents = eventsByDate.get(selectedDate) ?? [];
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function navigateMonth(month: Date, dateToSelect: Date) {
    setVisibleMonth(startOfMonth(month));
    setSelectedDate(dateInputValue(dateToSelect));
    setCalendarEvents([]);
    setCalendarError(null);
    setCalendarLoading(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Student portal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Your learning at a glance</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Courses, lecturer announcements, resources, and your internship applications in one place.</p>
      </div>

      <section aria-labelledby="student-calendar-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="student-calendar-heading" className="font-semibold">My calendar</h2>
            <p className="mt-1 text-xs text-slate-500">Classes and assignment deadlines from your enrolled units.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous month" onClick={() => {
              const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
              navigateMonth(month, month);
            }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">←</button>
            <h3 aria-live="polite" className="min-w-36 text-center text-sm font-semibold">{monthLabel}</h3>
            <button type="button" aria-label="Next month" onClick={() => {
              const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
              navigateMonth(month, month);
            }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">→</button>
            <button type="button" onClick={() => {
              const today = new Date();
              navigateMonth(today, today);
            }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Today</button>
          </div>
        </div>
        {calendarError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">
            <p>{calendarError}</p>
            <button type="button" onClick={() => { setCalendarLoading(true); void loadCalendar(); }} className="font-semibold underline">Try again</button>
          </div>
        )}
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-7 border-b border-slate-100 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {displayedDays.map((day) => {
              const dayKey = dateInputValue(day);
              const dayEvents = eventsByDate.get(dayKey) ?? [];
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = dayKey === dateInputValue(new Date());
              const isSelected = selectedDate === dayKey;
              return (
                <button
                  key={dayKey}
                  type="button"
                  aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${dayEvents.length ? `, ${dayEvents.length} ${dayEvents.length === 1 ? 'activity' : 'activities'}` : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedDate(dayKey);
                    if (!isCurrentMonth) navigateMonth(day, day);
                  }}
                  className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm transition sm:min-h-16 ${
                    isSelected
                      ? 'bg-blue-700 font-bold text-white'
                      : dayEvents.length
                        ? 'bg-blue-50 font-semibold text-blue-800 hover:bg-blue-100'
                        : 'text-slate-700 hover:bg-slate-50'
                  } ${!isCurrentMonth ? 'opacity-40' : ''} ${isToday && !isSelected ? 'ring-2 ring-blue-300 ring-inset' : ''}`}
                >
                  <span>{day.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <span className="flex gap-0.5" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : event.kind === 'assignment' ? 'bg-amber-500' : 'bg-blue-600'}`} />)}
                      {dayEvents.length > 3 && <span className="text-[9px] leading-none">+</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" />Class</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Assignment deadline</span>
            {calendarLoading && <span role="status">Updating calendar…</span>}
          </div>
        </div>
        <section aria-live="polite" aria-labelledby="student-selected-day-heading" className="border-t border-slate-100">
          <div className="px-5 py-4">
            <h3 id="student-selected-day-heading" className="font-semibold">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedDayEvents.length ? (
              <ol className="mt-3 divide-y divide-slate-100">
                {selectedDayEvents.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{event.unit_code} · {event.kind === 'assignment' ? 'Deadline' : 'Class'}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{event.title}</p>
                      {event.location && <p className="mt-0.5 text-xs text-slate-500">{event.location}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${event.kind === 'assignment' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        {event.kind === 'assignment' ? `Due ${event.start_time}` : `${event.start_time}–${event.end_time}`}
                      </span>
                      {event.kind === 'assignment' && <Link href="/assignments" className="text-sm font-semibold text-blue-700 hover:underline">Details</Link>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-500">{calendarLoading ? 'Loading your schedule…' : 'No classes or deadlines scheduled for this day.'}</p>
            )}
          </div>
        </section>
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
                    {announcement.course_code} · {announcement.created_at ? new Date(announcement.created_at).toLocaleString() : ''}
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
                  <p className="mt-1 text-sm text-slate-600">{placement.company} · {placement.location}</p>
                  <p className="mt-1 text-xs text-slate-500">{placement.slots_available} places available</p>
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
