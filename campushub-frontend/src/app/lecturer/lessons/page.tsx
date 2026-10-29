'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit, UnitLesson } from '@/types/portal';

interface TeachingOffering {
  id: number;
  unitCode: string;
  unitTitle: string;
  courseCode: string;
  courseTitle: string;
}

interface ScheduledLesson extends UnitLesson {
  offering_id: number;
  unitCode: string;
  unitTitle: string;
  courseCode: string;
  courseTitle: string;
}

interface LessonToast {
  kind: 'success' | 'error';
  message: string;
}

function dateTimeInputValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function LecturerLessonsPage() {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<TeachingOffering[]>([]);
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonScheduledAt, setLessonScheduledAt] = useState('');
  const [lessonDuration, setLessonDuration] = useState('60');
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<LessonToast | null>(null);

  const loadLessons = useCallback(async (signal?: AbortSignal) => {
    try {
      const unitsPage = await getApiPage<AcademicUnit>('/academics/units/', {}, signal);
      const assigned = unitsPage.results.flatMap((unit) => unit.offerings
        .filter((offering) => offering.lecturers.some((lecturer) => lecturer.id === user?.id))
        .map((offering) => ({
          id: offering.offering_id,
          unitCode: unit.code,
          unitTitle: unit.title,
          courseCode: offering.course_code,
          courseTitle: offering.course_title,
        })));
      const requestedOffering = typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('offeringId');
      const lessonPages = await Promise.all(assigned.map(async (offering) => {
        const response = await api.get<UnitLesson[]>(`/academics/offerings/${offering.id}/lessons/`, { signal });
        return response.data.map((lesson) => ({
          ...lesson,
          offering_id: offering.id,
          unitCode: offering.unitCode,
          unitTitle: offering.unitTitle,
          courseCode: offering.courseCode,
          courseTitle: offering.courseTitle,
        }));
      }));
      if (signal?.aborted) return;
      setOfferings(assigned);
      setLessons(lessonPages.flat().sort((left, right) => (
        Date.parse(left.scheduled_at) - Date.parse(right.scheduled_at)
      )));
      setNow(Date.now());
      setSelectedOfferingId((current) => current && assigned.some((offering) => String(offering.id) === current)
        ? current
        : requestedOffering && assigned.some((offering) => String(offering.id) === requestedOffering)
          ? requestedOffering
          : '');
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadLessons(controller.signal));
    return () => controller.abort();
  }, [loadLessons]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedOffering = offerings.find((offering) => String(offering.id) === selectedOfferingId);
  const unitLessons = lessons.filter((lesson) => String(lesson.offering_id) === selectedOfferingId);
  const visibleLessons = useMemo(() => lessons.filter((lesson) => {
    if (selectedOfferingId && String(lesson.offering_id) !== selectedOfferingId) return false;
    const query = search.trim().toLowerCase();
    return !query || [
      lesson.title,
      lesson.description,
      lesson.unitCode,
      lesson.unitTitle,
      lesson.courseCode,
      lesson.courseTitle,
    ].some((value) => value.toLowerCase().includes(query));
  }), [lessons, search, selectedOfferingId]);

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOffering || !lessonTitle.trim() || !lessonScheduledAt) {
      setToast({ kind: 'error', message: 'Choose a unit, lesson title, and date/time.' });
      return;
    }
    const durationMinutes = Number(lessonDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 300) {
      setToast({ kind: 'error', message: 'Lesson duration must be between 15 and 300 minutes.' });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        title: lessonTitle.trim(),
        description: lessonDescription.trim(),
        scheduled_at: new Date(lessonScheduledAt).toISOString(),
        duration_minutes: durationMinutes,
      };
      if (editingLessonId !== null) {
        await api.patch<UnitLesson>(`/academics/lessons/${editingLessonId}/`, payload);
      } else {
        await api.post<UnitLesson>(`/academics/offerings/${selectedOffering.id}/lessons/`, payload);
      }
      const wasEditing = editingLessonId !== null;
      setLessonTitle('');
      setLessonDescription('');
      setLessonScheduledAt('');
      setLessonDuration('60');
      setEditingLessonId(null);
      setToast({ kind: 'success', message: wasEditing ? 'Lesson updated and the course calendar was refreshed.' : `Lesson scheduled for ${selectedOffering.unitCode}. It has been added to the course calendar.` });
      await loadLessons();
    } catch (requestError) {
      setToast({ kind: 'error', message: getApiErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  function editLesson(lesson: ScheduledLesson) {
    setSelectedOfferingId(String(lesson.offering_id));
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description);
    setLessonScheduledAt(dateTimeInputValue(lesson.scheduled_at));
    setLessonDuration(String(lesson.duration_minutes ?? 60));
    setEditingLessonId(lesson.id);
    setToast(null);
  }

  function cancelEdit() {
    setEditingLessonId(null);
    setLessonTitle('');
    setLessonDescription('');
    setLessonScheduledAt('');
    setLessonDuration('60');
  }

  async function deleteLesson(lesson: ScheduledLesson) {
    if (!window.confirm(`Remove "${lesson.title}" from ${lesson.unitCode} and its calendar?`)) return;
    setDeletingId(lesson.id);
    setToast(null);
    try {
      await api.delete(`/academics/lessons/${lesson.id}/`);
      setLessons((current) => current.filter((item) => item.id !== lesson.id));
      setToast({ kind: 'success', message: `"${lesson.title}" was removed from the lesson plan and calendar.` });
    } catch (requestError) {
      setToast({ kind: 'error', message: getApiErrorMessage(requestError) });
    } finally {
      setDeletingId(null);
    }
  }

  const upcomingCount = lessons.filter((lesson) => Date.parse(lesson.scheduled_at) >= now).length;

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-5">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-blue-800 to-blue-700 p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Course planning</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div><h1 className="text-3xl font-bold tracking-tight">Lesson plan</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Schedule lessons across your teaching units and keep the class calendar up to date.</p></div>
            <div className="flex gap-2 text-sm"><span className="rounded-xl bg-white/15 px-3 py-2"><strong>{lessons.length}</strong> lessons</span><span className="rounded-xl bg-white/15 px-3 py-2"><strong>{upcomingCount}</strong> upcoming</span></div>
          </div>
        </header>

        {toast && <div role={toast.kind === 'error' ? 'alert' : 'status'} className={`fixed right-4 top-20 z-50 flex max-w-md items-start gap-3 rounded-xl border p-4 shadow-xl ${toast.kind === 'success' ? 'border-emerald-200 bg-white text-emerald-900' : 'border-red-200 bg-white text-red-900'}`}>
          <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toast.kind === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>{toast.kind === 'success' ? '✓' : '!'}</span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast(null)} className="rounded px-1 text-slate-400 hover:text-slate-700">×</button>
        </div>}

        {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your lesson plan…</p> : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5"><p role="alert" className="text-sm text-red-800">{error}</p><button type="button" onClick={() => { setLoading(true); void loadLessons(); }} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button></div>
        ) : !offerings.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="font-semibold">No units assigned yet</h2><p className="mt-2 text-sm text-slate-500">Once you are assigned to a unit, you can plan its lessons here.</p></div>
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
            <section aria-labelledby="scheduled-lessons-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div><h2 id="scheduled-lessons-heading" className="font-semibold">Scheduled lessons</h2><p className="mt-1 text-xs text-slate-500">Upcoming lessons and previous class sessions for your units.</p></div>
                <label className="w-full text-xs font-semibold text-slate-700 sm:max-w-xs">Search lessons<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Lesson or unit title" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              </div>
              <ul className="space-y-2">
                {visibleLessons.map((lesson, index) => {
                  const upcoming = Date.parse(lesson.scheduled_at) >= now;
                  return <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${upcoming ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>L{index + 1}</span>
                      <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{lesson.title}</p><p className="mt-0.5 text-xs font-medium text-blue-700">{lesson.unitCode} · {lesson.courseCode} · {lesson.unitTitle}</p>{lesson.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{lesson.description}</p>}<time className="mt-1 block text-xs text-slate-600">{new Date(lesson.scheduled_at).toLocaleString()}</time></div>
                    </div>
                    <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${upcoming ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{upcoming ? 'Upcoming' : 'Completed'}</span><button type="button" onClick={() => editLesson(lesson)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Edit</button><button type="button" onClick={() => void deleteLesson(lesson)} disabled={deletingId === lesson.id} aria-label={`Remove ${lesson.title}`} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{deletingId === lesson.id ? 'Removing…' : 'Remove'}</button></div>
                  </li>;
                })}
              </ul>
              {!visibleLessons.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-semibold text-slate-800">{lessons.length ? 'No lessons match your search' : 'No lessons scheduled yet'}</p><p className="mt-1 text-sm text-slate-500">{lessons.length ? 'Try another lesson or unit name.' : 'Use the planning form to schedule the first lesson.'}</p></div>}
            </section>

            <form onSubmit={saveLesson} className="space-y-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70 p-5 shadow-sm">
              <div><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Course planning</p><h2 className="mt-1 text-lg font-semibold">{editingLessonId !== null ? 'Edit lesson' : 'Plan a lesson'}</h2><p className="mt-1 text-sm text-slate-500">Lesson dates appear in the course calendar. Overlapping classes and lessons are blocked.</p></div>
              <label className="block text-sm font-medium text-slate-700">Unit / course<select required aria-label="Unit / course" value={selectedOfferingId} disabled={editingLessonId !== null} onChange={(event) => setSelectedOfferingId(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100"><option value="">Choose a unit</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.unitCode} · {offering.courseCode} — {offering.unitTitle}</option>)}</select></label>
              <label className="block text-sm font-medium text-slate-700">Lesson title<input required maxLength={200} value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} placeholder={`Lesson ${unitLessons.length + 1}`} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="block text-sm font-medium text-slate-700">Date and time<input required type="datetime-local" value={lessonScheduledAt} onChange={(event) => setLessonScheduledAt(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label>
              <label className="block text-sm font-medium text-slate-700">Duration (minutes)<input required type="number" min={15} max={300} step={15} value={lessonDuration} onChange={(event) => setLessonDuration(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label>
              <label className="block text-sm font-medium text-slate-700">Overview (optional)<textarea rows={3} maxLength={2000} value={lessonDescription} onChange={(event) => setLessonDescription(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label>
              <div className="flex gap-2"><button type="submit" disabled={saving} className="flex-1 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50">{saving ? (editingLessonId !== null ? 'Saving…' : 'Scheduling…') : editingLessonId !== null ? 'Save changes' : 'Schedule lesson'}</button>{editingLessonId !== null && <button type="button" onClick={cancelEdit} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>}</div>
              {selectedOffering && <p className="text-xs text-slate-500">Scheduling for {selectedOffering.unitCode} · {selectedOffering.courseTitle}</p>}
            </form>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
