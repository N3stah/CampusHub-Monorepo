'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, DirectoryUser } from '@/types/portal';

interface Department {
  id: number;
  name: string;
  code: string;
  head_id: number | null;
  is_active?: boolean;
}

interface DepartmentForm {
  name: string;
  code: string;
  head_id: string;
}

type DepartmentRoster = {
  students: DirectoryUser[];
  lecturers: DirectoryUser[];
  courses: Course[];
};

const emptyForm: DepartmentForm = { name: '', code: '', head_id: '' };
const emptyRoster: DepartmentRoster = { students: [], lecturers: [], courses: [] };

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturerOptions, setLecturerOptions] = useState<DirectoryUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roster, setRoster] = useState<DepartmentRoster>(emptyRoster);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [editing, setEditing] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [movingUserKey, setMovingUserKey] = useState<string | null>(null);
  const [targetDepartments, setTargetDepartments] = useState<Record<string, string>>({});

  const loadDepartments = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      getApiPage<Department>('/academics/departments/', {}, signal),
      getApiPage<DirectoryUser>('/lecturers/', {}, signal),
    ]);
    if (signal?.aborted) return;

    if (results[0].status === 'fulfilled') {
      const rows = results[0].value.results;
      setDepartments(rows);
      setSelectedId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id ?? null);
    }
    if (results[1].status === 'fulfilled') setLecturerOptions(results[1].value.results);
    const errors = results.flatMap((result, index) => result.status === 'rejected'
      ? [`${index === 0 ? 'Departments' : 'Lecturer choices'}: ${getApiErrorMessage(result.reason)}`]
      : []);
    setPageError(errors.length ? errors.join(' ') : null);
    setLoading(false);
  }, []);

  const loadRoster = useCallback(async (departmentId: number, signal?: AbortSignal) => {
    setRoster(emptyRoster);
    setRosterError(null);
    setRosterLoading(true);
    const results = await Promise.allSettled([
      getApiPage<DirectoryUser>('/users/', { role: 'student', department_id: departmentId }, signal),
      getApiPage<DirectoryUser>('/lecturers/', { department_id: departmentId }, signal),
      getApiPage<Course>('/academics/courses/', { department: departmentId }, signal),
    ]);
    if (signal?.aborted) return;

    const [studentResult, lecturerResult, courseResult] = results;
    if (studentResult.status === 'fulfilled') setRoster((current) => ({ ...current, students: studentResult.value.results }));
    if (lecturerResult.status === 'fulfilled') setRoster((current) => ({ ...current, lecturers: lecturerResult.value.results }));
    if (courseResult.status === 'fulfilled') setRoster((current) => ({ ...current, courses: courseResult.value.results }));
    const errors: string[] = [];
    if (studentResult.status === 'rejected') errors.push(`Students: ${getApiErrorMessage(studentResult.reason)}`);
    if (lecturerResult.status === 'rejected') errors.push(`Lecturers: ${getApiErrorMessage(lecturerResult.reason)}`);
    if (courseResult.status === 'rejected') errors.push(`Courses: ${getApiErrorMessage(courseResult.reason)}`);
    setRosterError(errors.length ? errors.join(' ') : null);
    setRosterLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadDepartments(controller.signal));
    return () => controller.abort();
  }, [loadDepartments]);

  useEffect(() => {
    if (selectedId === null) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => loadRoster(selectedId, controller.signal));
    return () => controller.abort();
  }, [loadRoster, selectedId]);

  function startEditing(department: Department) {
    setEditing(department);
    setForm({ name: department.name, code: department.code, head_id: department.head_id ? String(department.head_id) : '' });
    setFormError(null);
    setNotice(null);
  }

  function cancelEditing() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function saveDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      head_id: form.head_id ? Number(form.head_id) : null,
    };
    try {
      if (editing) {
        await api.patch(`/academics/departments/${editing.id}/`, payload);
        setNotice('Department updated.');
      } else {
        await api.post('/academics/departments/', payload);
        setNotice('Department created.');
      }
      setEditing(null);
      setForm(emptyForm);
      await loadDepartments();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDepartment(department: Department) {
    if (!window.confirm(`Deactivate ${department.name}?`)) return;
    setFormError(null);
    setNotice(null);
    try {
      await api.delete(`/academics/departments/${department.id}/`);
      setNotice(`${department.name} was deactivated.`);
      await loadDepartments();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  async function moveMember(user: DirectoryUser, route: 'users' | 'lecturers') {
    const userKey = `${route}:${user.id}`;
    const departmentId = targetDepartments[userKey];
    if (!departmentId || selectedId === null) return;
    setMovingUserKey(userKey);
    setRosterError(null);
    try {
      await api.patch(`/${route}/${user.id}/`, { department: Number(departmentId) });
      setTargetDepartments((current) => ({ ...current, [userKey]: '' }));
      await loadRoster(selectedId);
      setNotice(`${user.first_name} ${user.last_name} moved to the selected department.`);
    } catch (error) {
      setRosterError(getApiErrorMessage(error));
    } finally {
      setMovingUserKey(null);
    }
  }

  const selectedDepartment = departments.find((department) => department.id === selectedId) ?? null;
  const selectedHead = lecturerOptions.find((lecturer) => lecturer.id === selectedDepartment?.head_id);

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administration</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Departments</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Manage department details and review its students, lecturers, and courses.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {pageError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{pageError}</p>
          <button type="button" onClick={() => { setLoading(true); void loadDepartments(); }} className="mt-2 font-semibold underline">Retry loading departments</button>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <form onSubmit={saveDepartment} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{editing ? 'Edit department' : 'Add department'}</h2>
            {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Code
              <input required maxLength={10} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Department head
              <select value={form.head_id} onChange={(event) => setForm({ ...form, head_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">Not assigned</option>
                {lecturerOptions.filter((lecturer) => lecturer.is_active).map((lecturer) => (
                  <option key={lecturer.id} value={lecturer.id}>{lecturer.first_name} {lecturer.last_name}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add department'}
              </button>
              {editing && <button type="button" onClick={cancelEditing} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>}
            </div>
          </form>

          <section aria-labelledby="department-list-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 id="department-list-heading" className="border-b border-slate-100 px-5 py-4 font-semibold">All departments</h2>
            {loading ? <p role="status" className="p-5 text-sm text-slate-500">Loading departments…</p> : departments.length ? (
              <ul className="divide-y divide-slate-100">
                {departments.map((department) => (
                  <li key={department.id} className={`flex items-center justify-between gap-2 p-3 ${department.id === selectedId ? 'bg-blue-50' : ''}`}>
                    <button type="button" onClick={() => setSelectedId(department.id)} aria-pressed={department.id === selectedId} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold text-slate-900">{department.name}</span>
                      <span className="text-xs text-slate-500">{department.code}</span>
                    </button>
                    <button type="button" onClick={() => startEditing(department)} className="rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-white">Edit</button>
                    <button type="button" onClick={() => void deactivateDepartment(department)} className="rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-white">Deactivate</button>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-sm text-slate-500">No departments found.</p>}
          </section>
        </div>

        <section aria-labelledby="department-details-heading" className="space-y-4">
          {selectedDepartment ? (
            <>
              <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{selectedDepartment.code}</p>
                <h2 id="department-details-heading" className="mt-1 text-xl font-semibold">{selectedDepartment.name}</h2>
                <p className="mt-2 text-sm text-slate-600">Department head: {selectedHead ? `${selectedHead.first_name} ${selectedHead.last_name}` : selectedDepartment.head_id ? `Lecturer #${selectedDepartment.head_id}` : 'Not assigned'}</p>
              </header>
              {rosterError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{rosterError}</p>}
              {rosterLoading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading department members…</p> : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <RosterCard title="Students" count={roster.students.length} href="/users" action="Student directory">
                    {roster.students.map((student) => (
                      <li key={student.id} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{student.first_name} {student.last_name}</span>
                          <span className="truncate text-xs text-slate-500">{student.email}</span>
                        </div>
                        <div className="flex gap-2">
                          <select aria-label={`Move ${student.first_name} ${student.last_name} to a department`} value={targetDepartments[`users:${student.id}`] ?? ''} onChange={(event) => setTargetDepartments((current) => ({ ...current, [`users:${student.id}`]: event.target.value }))} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                            <option value="">Move to department…</option>
                            {departments.filter((department) => department.id !== selectedId).map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
                          </select>
                          <button type="button" disabled={movingUserKey === `users:${student.id}` || !targetDepartments[`users:${student.id}`]} onClick={() => void moveMember(student, 'users')} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-blue-700 disabled:opacity-50">{movingUserKey === `users:${student.id}` ? 'Moving…' : 'Move'}</button>
                        </div>
                      </li>
                    ))}
                  </RosterCard>
                  <RosterCard title="Lecturers" count={roster.lecturers.length} href="/lecturers" action="Lecturer directory">
                    {roster.lecturers.map((lecturer) => (
                      <li key={lecturer.id} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{lecturer.first_name} {lecturer.last_name}</span>
                          <span className="truncate text-xs text-slate-500">{lecturer.email}</span>
                        </div>
                        <div className="flex gap-2">
                          <select aria-label={`Move ${lecturer.first_name} ${lecturer.last_name} to a department`} value={targetDepartments[`lecturers:${lecturer.id}`] ?? ''} onChange={(event) => setTargetDepartments((current) => ({ ...current, [`lecturers:${lecturer.id}`]: event.target.value }))} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                            <option value="">Move to department…</option>
                            {departments.filter((department) => department.id !== selectedId).map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
                          </select>
                          <button type="button" disabled={movingUserKey === `lecturers:${lecturer.id}` || !targetDepartments[`lecturers:${lecturer.id}`]} onClick={() => void moveMember(lecturer, 'lecturers')} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-blue-700 disabled:opacity-50">{movingUserKey === `lecturers:${lecturer.id}` ? 'Moving…' : 'Move'}</button>
                        </div>
                      </li>
                    ))}
                  </RosterCard>
                  <RosterCard title="Courses" count={roster.courses.length} href="/admin/courses" action="Manage courses">
                    {roster.courses.map((course) => (
                      <li key={course.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span><span className="font-semibold">{course.code}</span> <span className="text-slate-700">{course.title}</span></span>
                        <span className="text-xs text-slate-500">{course.lecturer_id ? `Lecturer #${course.lecturer_id}` : 'Unassigned'}</span>
                      </li>
                    ))}
                  </RosterCard>
                </div>
              )}
            </>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              {loading ? 'Loading departments…' : 'Add or select a department to review its members and courses.'}
            </p>
          )}
        </section>
      </section>
    </section>
  );
}

function RosterCard({ title, count, children, href, action }: { title: string; count: number; children: ReactNode; href: string; action: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h3 className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 font-semibold">
        <span>{title} <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{count}</span></span>
        <Link href={href} className="text-xs font-semibold text-blue-700 hover:underline">{action}</Link>
      </h3>
      {count ? <ul className="divide-y divide-slate-100">{children}</ul> : <p className="p-4 text-sm text-slate-500">No {title.toLowerCase()} found in this department.</p>}
    </section>
  );
}
