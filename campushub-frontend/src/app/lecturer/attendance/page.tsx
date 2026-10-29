'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit, ClassSession } from '@/types/portal';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

interface AttendanceRow {
  student_id: number;
  student_name: string;
  admission_number: string | null;
  course_code: string;
  course_title: string;
  status: AttendanceStatus | null;
  note: string;
}

interface AttendanceSession extends ClassSession {
  offering_id: number;
  unit_code: string;
  unit_title: string;
  course_code: string;
  course_title: string;
}

interface AttendanceResponse {
  session: AttendanceSession;
  date: string;
  records: AttendanceRow[];
}

const PAGE_SIZE = 30;
const STATUS_OPTIONS: { value: AttendanceStatus; label: string; className: string }[] = [
  { value: 'present', label: 'Present', className: 'bg-emerald-50 text-emerald-800' },
  { value: 'late', label: 'Late', className: 'bg-amber-50 text-amber-800' },
  { value: 'absent', label: 'Absent', className: 'bg-red-50 text-red-800' },
  { value: 'excused', label: 'Excused', className: 'bg-slate-100 text-slate-700' },
];

function localDateValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function LecturerAttendancePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [today, setToday] = useState('');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rosterLoaded, setRosterLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentDate = localDateValue();
      setToday(currentDate);
      setAttendanceDate((value) => value || currentDate);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    try {
      const units = await getApiPage<AcademicUnit>('/academics/units/', {}, signal);
      const assigned = units.results.flatMap((unit) => unit.offerings
        .filter((offering) => offering.lecturers.some((lecturer) => lecturer.id === user?.id))
        .map((offering) => ({
          unit,
          offering,
        })));
      const sessionLists = await Promise.all(assigned.map(async ({ unit, offering }) => {
        const response = await api.get<ClassSession[]>(`/academics/offerings/${offering.offering_id}/sessions/`, { signal });
        return response.data.map((session) => ({
          ...session,
          offering_id: offering.offering_id,
          unit_code: unit.code,
          unit_title: unit.title,
          course_code: offering.course_code,
          course_title: offering.course_title,
        }));
      }));
      if (signal?.aborted) return;
      const loaded = sessionLists.flat();
      setSessions(loaded);
      const selectedFromUrl = new URLSearchParams(window.location.search).get('sessionId');
      setSelectedSessionId((current) => current && loaded.some((session) => String(session.id) === current)
        ? current
        : selectedFromUrl && loaded.some((session) => String(session.id) === selectedFromUrl)
          ? selectedFromUrl
          : String(loaded[0]?.id ?? ''));
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoadingSessions(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadSessions(controller.signal));
    return () => controller.abort();
  }, [loadSessions]);

  const selectedSession = sessions.find((session) => String(session.id) === selectedSessionId);
  const loadAttendance = useCallback(async (signal?: AbortSignal, clearNotice = true) => {
    if (!selectedSessionId || !attendanceDate) {
      setRows([]);
      setRosterLoaded(false);
      return;
    }
    setLoadingRoster(true);
    setError(null);
    if (clearNotice) setNotice(null);
    try {
      const response = await api.get<AttendanceResponse>(
        `/academics/sessions/${selectedSessionId}/attendance/`,
        { params: { date: attendanceDate }, signal },
      );
      if (signal?.aborted) return;
      setRows(response.data.records);
      setRosterLoaded(true);
      setPage(1);
    } catch (requestError) {
      if (!signal?.aborted) {
        setRows([]);
        setRosterLoaded(false);
        setError(getApiErrorMessage(requestError));
      }
    } finally {
      if (!signal?.aborted) setLoadingRoster(false);
    }
  }, [attendanceDate, selectedSessionId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAttendance(controller.signal));
    return () => controller.abort();
  }, [loadAttendance]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return !query || row.student_name.toLowerCase().includes(query)
      || (row.admission_number ?? '').toLowerCase().includes(query);
  }), [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const markedCount = rows.filter((row) => row.status !== null).length;
  const counts = STATUS_OPTIONS.map((status) => ({
    ...status,
    count: rows.filter((row) => row.status === status.value).length,
  }));

  function updateRow(studentId: number, patch: Partial<AttendanceRow>) {
    setRows((current) => current.map((row) => row.student_id === studentId ? { ...row, ...patch } : row));
  }

  async function saveAttendance() {
    if (!selectedSession || !rows.length) return;
    const records = rows.filter((row) => row.status !== null).map(({ student_id, status, note }) => ({
      student_id,
      status,
      note,
    }));
    if (!records.length) {
      setError('Mark at least one student before saving attendance.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.put(`/academics/sessions/${selectedSession.id}/attendance/?date=${attendanceDate}`, { records });
      setNotice(`Attendance saved for ${selectedSession.unit_code} on ${new Date(`${attendanceDate}T00:00:00`).toLocaleDateString()}.`);
      await loadAttendance(undefined, false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-5">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-teal-700 to-cyan-700 p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Class management</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div><h1 className="text-3xl font-bold tracking-tight">Attendance</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">Take and correct attendance for scheduled classes, with records saved against each class date.</p></div>
            <span className="rounded-xl bg-white/15 px-3 py-2 text-sm"><strong>{markedCount}</strong> of {rows.length} marked</span>
          </div>
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

        {loadingSessions ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading scheduled classes…</p>
          : !sessions.length ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><h2 className="font-semibold">No scheduled classes</h2><p className="mt-2 text-sm text-slate-500">Add a weekly class to your teaching calendar before taking attendance.</p></div>
            : <>
              <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="block text-sm font-medium text-slate-700">Class session<select aria-label="Class session" value={selectedSessionId} onChange={(event) => { setSelectedSessionId(event.target.value); setSearch(''); setPage(1); }} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.unit_code} · {session.course_code} — {session.day_name}, {session.start_time}–{session.end_time} · {session.location || 'Location not set'}</option>)}
                </select></label>
                <div className="flex items-end gap-2"><label className="block flex-1 text-sm font-medium text-slate-700">Class date<input aria-label="Class date" type="date" max={today || undefined} value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" /></label><button type="button" disabled={!today} onClick={() => setAttendanceDate(today)} className="rounded-lg border border-emerald-200 px-3 py-2.5 text-xs font-semibold text-emerald-800 disabled:opacity-40">Today</button></div>
                {selectedSession && <p className="text-xs text-slate-500 sm:col-span-2">{selectedSession.unit_title} · {selectedSession.course_title} · {selectedSession.day_name} {selectedSession.start_time}–{selectedSession.end_time}</p>}
              </section>

              {error ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-semibold text-slate-800">Attendance unavailable for this date</h2><p className="mt-1 text-sm text-slate-500">Choose a date that falls on this class’s scheduled weekday and term.</p></div>
                : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
                    <div><h2 className="font-semibold">Class roster</h2><p className="mt-1 text-xs text-slate-500">{rows.length} enrolled · {markedCount} marked</p></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700">Search roster<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name or registration number" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" /></label>
                      <button type="button" disabled={!rows.length || loadingRoster} onClick={() => setRows((current) => current.map((row) => ({ ...row, status: 'present' })))} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">Mark all present</button>
                    </div>
                  </div>
                  {loadingRoster ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading class roster…</p> : rosterLoaded && rows.length ? <>
                    <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 sm:grid-cols-4">
                      {counts.map((item) => <div key={item.value} className={`rounded-lg px-3 py-2 ${item.className}`}><span className="block text-[11px] font-semibold uppercase tracking-wide">{item.label}</span><strong className="mt-0.5 block text-lg">{item.count}</strong></div>)}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[54rem] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Registration number</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Note (optional)</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{visibleRows.map((row) => <tr key={row.student_id}>
                          <td className="px-4 py-3 font-medium text-slate-900">{row.student_name}<span className="mt-0.5 block text-xs text-slate-500">{row.course_code} · {row.course_title}</span></td>
                          <td className="px-4 py-3 text-slate-600">{row.admission_number || 'Not provided'}</td>
                          <td className="px-4 py-3"><select aria-label={`Attendance for ${row.student_name}`} value={row.status ?? ''} onChange={(event) => updateRow(row.student_id, { status: (event.target.value || null) as AttendanceStatus | null })} className={`rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-semibold ${row.status ? STATUS_OPTIONS.find((option) => option.value === row.status)?.className : 'bg-white text-slate-500'}`}><option value="">Unmarked</option>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
                          <td className="px-4 py-3"><input aria-label={`Attendance note for ${row.student_name}`} maxLength={500} value={row.note} onChange={(event) => updateRow(row.student_id, { note: event.target.value })} placeholder="Optional note" className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs" /></td>
                        </tr>)}</tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
                      <p className="text-xs text-slate-500">Showing {filteredRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</p>
                      <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button><span className="text-xs text-slate-600">Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button></div>
                      <button type="button" disabled={saving || !markedCount} onClick={() => void saveAttendance()} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Saving attendance…' : 'Save attendance'}</button>
                    </div>
                  </> : rosterLoaded ? <p className="p-8 text-center text-sm text-slate-500">No active students are enrolled in this unit.</p> : null}
                </section>}
            </>}
      </section>
    </PortalShell>
  );
}
