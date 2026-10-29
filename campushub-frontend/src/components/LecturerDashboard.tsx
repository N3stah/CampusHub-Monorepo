'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit, CalendarEvent, ClassSession } from '@/types/portal';

interface AssignedUnit {
  unit: AcademicUnit;
  offeringId: number;
}

interface LecturerSummary {
  unit_count: number;
  upcoming_lesson_count: number;
  upcoming_assignment_count: number;
  unmarked_submission_count: number;
  pending_assignments: { id: number; title: string; unit_code: string; unmarked_count: number }[];
  upcoming_dates: { id: string; title: string; unit_code: string; kind: string; at: string }[];
}

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthStartValue(value: Date) {
  return dateInputValue(startOfMonth(value));
}

function monthEndValue(value: Date) {
  return dateInputValue(new Date(value.getFullYear(), value.getMonth() + 1, 0));
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

function formatEventDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function LecturerDashboard() {
  const { user } = useAuth();
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState<LecturerSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue(new Date()));
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const today = useMemo(() => new Date(), []);
  const termEnd = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 4);
    return date;
  }, []);
  const [sessionForm, setSessionForm] = useState({
    offering_id: '',
    day_of_week: '0',
    start_time: '09:00',
    end_time: '10:00',
    starts_on: dateInputValue(today),
    ends_on: dateInputValue(termEnd),
    location: '',
  });

  const assignedUnits = useMemo<AssignedUnit[]>(() => units.flatMap((unit) => (
    unit.offerings
      .filter((offering) => offering.lecturers.some((lecturer) => lecturer.id === user?.id))
      .map((offering) => ({ unit, offeringId: offering.offering_id }))
  )), [units, user?.id]);

  const loadUnits = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await getApiPage<AcademicUnit>('/academics/units/', {}, signal);
      setUnits(page.results);
      setUnitsError(null);
    } catch (requestError) {
      if (!signal?.aborted) setUnitsError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setUnitsLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<CalendarEvent[]>('/academics/calendar/', {
        params: { from: monthStartValue(visibleMonth), to: monthEndValue(visibleMonth) },
        signal,
      });
      setEvents(response.data);
      setCalendarError(null);
    } catch (requestError) {
      if (!signal?.aborted) setCalendarError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setCalendarLoading(false);
    }
  }, [visibleMonth]);

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<LecturerSummary>('/academics/lecturer/summary/', { signal });
      if (signal?.aborted) return;
      setSummary(response.data);
      setSummaryError(null);
    } catch (requestError) {
      if (!signal?.aborted) setSummaryError(getApiErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadUnits(controller.signal);
      void loadCalendar(controller.signal);
      void loadSummary(controller.signal);
    });
    return () => controller.abort();
  }, [loadUnits, loadCalendar, loadSummary]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    return grouped;
  }, [events]);
  const displayedDays = useMemo(() => monthDays(visibleMonth), [visibleMonth]);
  const selectedDayEvents = eventsByDate.get(selectedDate) ?? [];
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const pendingAssignments = summary?.pending_assignments ?? [];

  const selectedOfferingId = sessionForm.offering_id || String(assignedUnits[0]?.offeringId ?? '');

  async function addClassSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSession(true);
    setScheduleError(null);
    setScheduleNotice(null);
    try {
      await api.post<ClassSession>(`/academics/offerings/${selectedOfferingId}/sessions/`, {
        ...sessionForm,
        day_of_week: Number(sessionForm.day_of_week),
      });
      setScheduleNotice('Class added to your calendar.');
      setCalendarLoading(true);
      await loadCalendar();
    } catch (requestError) {
      setScheduleError(getApiErrorMessage(requestError));
    } finally {
      setSavingSession(false);
    }
  }

  return (
    <section className="space-y-7">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Lecturer portal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your assigned units, teaching calendar, and upcoming deadlines.</p>
      </header>

      <section aria-labelledby="lecturer-units-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="lecturer-units-heading" className="font-semibold">Your units</h2>
            <p className="mt-1 text-xs text-slate-500">Open a unit to manage its students and learning activities.</p>
          </div>
          <Link href="/lecturer/units" className="text-sm font-semibold text-blue-700 hover:underline">All units</Link>
        </div>
        {unitsLoading ? (
          <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading your units…</p>
        ) : unitsError ? (
          <div className="p-5">
            <p role="alert" className="text-sm text-red-700">{unitsError}</p>
            <button type="button" onClick={() => { setUnitsLoading(true); void loadUnits(); }} className="mt-2 text-sm font-semibold text-blue-700 hover:underline">Try again</button>
          </div>
        ) : assignedUnits.length ? (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {assignedUnits.map(({ unit, offeringId }) => (
              <li key={offeringId}>
                <Link
                  href={`/lecturer/units/${offeringId}`}
                  className="block h-full rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{unit.code}</p>
                  <p className="mt-1 font-semibold text-slate-900">{unit.title}</p>
                  <span className="mt-3 inline-flex text-sm font-semibold text-blue-700">Open unit →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No units are currently assigned to your account.</p>
        )}
      </section>

      <section aria-label="Teaching at a glance" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-semibold text-slate-900">Teaching at a glance</h2><p className="mt-1 text-xs text-slate-500">The next steps and activity that may need your attention.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/lecturer/lessons" className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50">Plan lessons</Link><Link href="/lecturer/attendance" className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">Take attendance</Link><Link href="/lecturer/materials" className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50">Publish materials</Link></div>
        </div>
        {summaryError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><p>{summaryError}</p><button type="button" onClick={() => void loadSummary()} className="font-semibold underline">Try again</button></div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Assigned units', count: summary?.unit_count ?? assignedUnits.length, href: '/lecturer/units', color: 'text-blue-700', caption: 'Open your teaching units' },
            { label: 'Upcoming lessons', count: summary?.upcoming_lesson_count ?? '—', href: '/lecturer/lessons', color: 'text-indigo-700', caption: 'Review your lesson plan' },
            { label: 'Assignment deadlines', count: summary?.upcoming_assignment_count ?? '—', href: '/assignments', color: 'text-amber-700', caption: 'Review published work' },
            { label: 'Submissions to mark', count: summary?.unmarked_submission_count ?? '—', href: pendingAssignments[0] ? `/lecturer/assignments/${pendingAssignments[0].id}` : '/assignments', color: 'text-emerald-700', caption: 'Review student work' },
          ].map((item) => <Link key={item.label} href={item.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</span><strong className={`mt-1 block text-2xl ${item.color}`}>{item.count}</strong><span className="mt-1 block text-xs text-slate-500">{item.caption}</span></Link>)}
        </div>
        {pendingAssignments.length ? <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><h3 className="text-sm font-semibold text-amber-900">Marking queue</h3><ul className="mt-2 grid gap-2 sm:grid-cols-2">{pendingAssignments.map((assignment) => <li key={assignment.id}><Link href={`/lecturer/assignments/${assignment.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2.5 text-sm hover:border-amber-300"><span className="min-w-0"><span className="block truncate font-medium text-slate-900">{assignment.title}</span><span className="text-xs text-slate-500">{assignment.unit_code}</span></span><span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{assignment.unmarked_count} to mark</span></Link></li>)}</ul></section> : null}
      </section>

      <section aria-labelledby="lecturer-calendar-heading" className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id="lecturer-calendar-heading" className="font-semibold">Teaching calendar</h2>
              <p className="mt-1 text-xs text-slate-500">Select a highlighted day to see its classes and deadlines.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous month" onClick={() => {
                const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
                setVisibleMonth(month);
                setSelectedDate(dateInputValue(month));
                setEvents([]);
                setCalendarError(null);
                setCalendarLoading(true);
              }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">←</button>
              <h3 aria-live="polite" className="min-w-36 text-center text-sm font-semibold">{monthLabel}</h3>
              <button type="button" aria-label="Next month" onClick={() => {
                const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
                setVisibleMonth(month);
                setSelectedDate(dateInputValue(month));
                setEvents([]);
                setCalendarError(null);
                setCalendarLoading(true);
              }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">→</button>
              <button type="button" onClick={() => {
                const month = startOfMonth(new Date());
                setVisibleMonth(month);
                setSelectedDate(dateInputValue(new Date()));
                setEvents([]);
                setCalendarError(null);
                setCalendarLoading(true);
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
                      if (!isCurrentMonth) {
                        setVisibleMonth(startOfMonth(day));
                        setEvents([]);
                        setCalendarError(null);
                        setCalendarLoading(true);
                      }
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
                      <span className={`flex gap-0.5 ${isSelected ? 'text-white' : ''}`} aria-hidden="true">
                        {dayEvents.slice(0, 3).map((item) => <span key={item.id} className={`h-1 w-1 rounded-full ${isSelected ? 'bg-white' : item.kind === 'assignment' ? 'bg-amber-500' : item.kind === 'lesson' ? 'bg-emerald-500' : 'bg-blue-600'}`} />)}
                        {dayEvents.length > 3 && <span className="text-[9px] leading-none">+</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" />Class</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Lesson</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Assignment deadline</span>
              {calendarLoading && <span role="status" className="ml-auto">Updating calendar…</span>}
            </div>
          </div>
          <section aria-live="polite" aria-labelledby="selected-day-heading" className="border-t border-slate-100">
            <div className="px-5 py-4">
              <h3 id="selected-day-heading" className="font-semibold">{formatEventDate(selectedDate)}</h3>
              {selectedDayEvents.length ? (
                <ol className="mt-3 divide-y divide-slate-100">
                  {selectedDayEvents.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{item.unit_code} · {item.kind === 'assignment' ? 'Deadline' : item.kind === 'lesson' ? 'Lesson' : 'Class'}</p>
                        <p className="mt-1 truncate text-sm font-semibold">{item.title}</p>
                        {item.location && <p className="mt-0.5 text-xs text-slate-500">{item.location}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.kind === 'assignment' ? 'bg-amber-50 text-amber-800' : item.kind === 'lesson' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {item.kind === 'assignment' ? `Due ${item.start_time}` : item.kind === 'lesson' ? item.start_time : `${item.start_time}–${item.end_time}`}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No classes or deadlines scheduled for this day.</p>
              )}
            </div>
          </section>
        </div>

        <form onSubmit={addClassSession} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold">Add a class</h2>
            <p className="mt-1 text-xs text-slate-500">Create a weekly class entry for one of your units.</p>
          </div>
          {scheduleError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{scheduleError}</p>}
          {scheduleNotice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{scheduleNotice}</p>}
          <label className="block text-sm font-medium text-slate-700">
            Unit
            <select required value={selectedOfferingId} onChange={(event) => setSessionForm({ ...sessionForm, offering_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5">
              {assignedUnits.map(({ unit, offeringId }) => <option key={offeringId} value={offeringId}>{unit.code} · {unit.title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Day
            <select value={sessionForm.day_of_week} onChange={(event) => setSessionForm({ ...sessionForm, day_of_week: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5">
              {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">Starts<input required type="time" value={sessionForm.start_time} onChange={(event) => setSessionForm({ ...sessionForm, start_time: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="block text-sm font-medium text-slate-700">Ends<input required type="time" value={sessionForm.end_time} onChange={(event) => setSessionForm({ ...sessionForm, end_time: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">Term starts<input required type="date" value={sessionForm.starts_on} onChange={(event) => setSessionForm({ ...sessionForm, starts_on: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="block text-sm font-medium text-slate-700">Term ends<input required type="date" value={sessionForm.ends_on} onChange={(event) => setSessionForm({ ...sessionForm, ends_on: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Room or meeting location
            <input maxLength={200} value={sessionForm.location} onChange={(event) => setSessionForm({ ...sessionForm, location: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="e.g. Lab 2" />
          </label>
          <button type="submit" disabled={savingSession || assignedUnits.length === 0} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {savingSession ? 'Adding class…' : 'Add to calendar'}
          </button>
          {!assignedUnits.length && <p className="text-xs text-slate-500">A class can be added after a unit is assigned to you.</p>}
        </form>
      </section>
    </section>
  );
}
