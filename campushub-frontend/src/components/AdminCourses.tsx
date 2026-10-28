'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, School } from '@/types/portal';

interface Department {
  id: number;
  name: string;
  code: string;
  school_id: number;
  school__name: string;
}

interface CourseForm {
  title: string;
  code: string;
  school_id: string;
  department_id: string;
  credits: string;
  description: string;
}

const emptyForm: CourseForm = {
  title: '',
  code: '',
  school_id: '',
  department_id: '',
  credits: '120',
  description: '',
};

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [editing, setEditing] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      getApiPage<Course>('/academics/courses/', { include_inactive: 'true' }, signal),
      getApiPage<Department>('/academics/departments/', {}, signal),
      getApiPage<School>('/academics/schools/', {}, signal),
    ]);
    if (signal?.aborted) return;

    if (results[0].status === 'fulfilled') setCourses(results[0].value.results);
    if (results[1].status === 'fulfilled') setDepartments(results[1].value.results);
    if (results[2].status === 'fulfilled') setSchools(results[2].value.results);
    const errors = results.flatMap((result, index) => result.status === 'rejected'
      ? [`${['Programmes', 'Departments', 'Schools'][index]}: ${getApiErrorMessage(result.reason)}`]
      : []);
    setLoadError(errors.length ? errors.join(' ') : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadData(controller.signal));
    return () => controller.abort();
  }, [loadData]);

  function startEditing(course: Course) {
    const department = departments.find((item) => item.id === course.department_id);
    setEditing(course);
    setForm({
      title: course.title,
      code: course.code,
      school_id: department ? String(department.school_id) : '',
      department_id: String(course.department_id),
      credits: String(course.credits),
      description: course.description ?? '',
    });
    setFormError(null);
    setNotice(null);
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    const { school_id, ...programmeData } = form;
    void school_id;
    const payload = {
      ...programmeData,
      title: programmeData.title.trim(),
      code: programmeData.code.trim().toUpperCase(),
      department_id: Number(programmeData.department_id),
      credits: Number(programmeData.credits),
      description: programmeData.description.trim(),
    };
    try {
      if (editing) {
        await api.patch(`/academics/courses/${editing.id}/`, payload);
        setNotice('Course updated.');
      } else {
        await api.post('/academics/courses/', payload);
        setNotice('Course created.');
      }
      resetForm();
      await loadData();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateCourse(course: Course) {
    if (!window.confirm(`Deactivate ${course.code} — ${course.title}?`)) return;
    setFormError(null);
    setNotice(null);
    try {
      await api.delete(`/academics/courses/${course.id}/`);
      setNotice(`${course.code} was deactivated.`);
      await loadData();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  async function reactivateCourse(course: Course) {
    setFormError(null);
    setNotice(null);
    try {
      await api.patch(`/academics/courses/${course.id}/`, { is_active: true });
      setNotice(`${course.code} reactivated.`);
      await loadData();
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  const departmentNames = new Map(departments.map((department) => [department.id, `${department.school__name} / ${department.code} — ${department.name}`]));

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administration</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Academic programmes</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">A programme belongs to one department and inherits its school. Add shared units and assign lecturers on the Units and teaching page.</p>
        <Link href="/admin/units" className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">Manage units and teaching →</Link>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loadError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); void loadData(); }} className="mt-2 font-semibold underline">Retry loading</button>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
        <form onSubmit={saveCourse} className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{editing ? 'Edit programme' : 'Add programme'}</h2>
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
          <label className="block text-sm font-medium text-slate-700">
            Programme title
            <input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Programme code
            <input required maxLength={20} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            School
            <select required value={form.school_id} onChange={(event) => setForm({ ...form, school_id: event.target.value, department_id: '' })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Choose a school</option>
              {schools.filter((school) => school.code !== 'UNASSIGNED').map((school) => <option key={school.id} value={school.id}>{school.code} — {school.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Department
            <select required value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Choose department</option>
              {departments.filter((department) => String(department.school_id) === form.school_id).map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Total programme credits
            <input required type="number" min={1} max={500} value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !schools.some((school) => school.code !== 'UNASSIGNED')} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save programme' : 'Add programme'}
            </button>
            {editing && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>}
          </div>
        </form>

        <section aria-labelledby="course-list-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id="course-list-heading" className="font-semibold">Programme catalogue</h2>
          </div>
          {loading ? <p role="status" className="p-6 text-center text-sm text-slate-500">Loading courses…</p> : courses.length ? (
            <>
              <ul className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <li key={course.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{course.code} · {course.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{departmentNames.get(course.department_id) ?? course.department_name ?? `Department #${course.department_id}`} · {course.units?.length ?? 0} shared units{!course.is_active && ' · Inactive'}</p>
                    </div>
                    <button type="button" onClick={() => startEditing(course)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                    {course.is_active ? (
                      <button type="button" onClick={() => void deactivateCourse(course)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Deactivate</button>
                    ) : (
                      <button type="button" onClick={() => void reactivateCourse(course)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Reactivate</button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="p-6 text-center text-sm text-slate-500">No programmes found. Add one after creating a school and department.</p>}
        </section>
      </section>
    </section>
  );
}
