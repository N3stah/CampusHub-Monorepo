'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, DirectoryUser } from '@/types/portal';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface CourseForm {
  title: string;
  code: string;
  department_id: string;
  lecturer_id: string;
  credits: string;
  description: string;
}

const emptyForm: CourseForm = {
  title: '',
  code: '',
  department_id: '',
  lecturer_id: '',
  credits: '3',
  description: '',
};

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<DirectoryUser[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [bulkLecturerId, setBulkLecturerId] = useState('');
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [editing, setEditing] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      getApiPage<Course>('/academics/courses/', {}, signal),
      getApiPage<Department>('/academics/departments/', {}, signal),
      getApiPage<DirectoryUser>('/lecturers/', {}, signal),
    ]);
    if (signal?.aborted) return;

    if (results[0].status === 'fulfilled') setCourses(results[0].value.results);
    if (results[1].status === 'fulfilled') setDepartments(results[1].value.results);
    if (results[2].status === 'fulfilled') setLecturers(results[2].value.results);
    const errors = results.flatMap((result, index) => result.status === 'rejected'
      ? [`${['Courses', 'Departments', 'Lecturers'][index]}: ${getApiErrorMessage(result.reason)}`]
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
    setEditing(course);
    setForm({
      title: course.title,
      code: course.code,
      department_id: String(course.department_id),
      lecturer_id: course.lecturer_id ? String(course.lecturer_id) : '',
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
    const payload = {
      title: form.title.trim(),
      code: form.code.trim().toUpperCase(),
      department_id: Number(form.department_id),
      lecturer_id: form.lecturer_id ? Number(form.lecturer_id) : null,
      credits: Number(form.credits),
      description: form.description.trim(),
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
    setAssignmentError(null);
    setNotice(null);
    try {
      await api.delete(`/academics/courses/${course.id}/`);
      setSelectedCourses((current) => current.filter((id) => id !== course.id));
      setNotice(`${course.code} was deactivated.`);
      await loadData();
    } catch (error) {
      setAssignmentError(getApiErrorMessage(error));
    }
  }

  function toggleCourse(courseId: number) {
    setSelectedCourses((current) => current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId]);
  }

  async function assignSelectedCourses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourses.length) {
      setAssignmentError('Select at least one course to assign.');
      return;
    }
    setAssigning(true);
    setAssignmentError(null);
    setNotice(null);
    try {
      await api.post('/academics/courses/assign-lecturer/', {
        course_ids: selectedCourses,
        lecturer_id: bulkLecturerId ? Number(bulkLecturerId) : null,
      });
      setNotice(`Lecturer assignment updated for ${selectedCourses.length} course${selectedCourses.length === 1 ? '' : 's'}.`);
      setSelectedCourses([]);
      await loadData();
    } catch (error) {
      setAssignmentError(getApiErrorMessage(error));
    } finally {
      setAssigning(false);
    }
  }

  const lecturerNames = new Map(lecturers.map((lecturer) => [lecturer.id, `${lecturer.first_name} ${lecturer.last_name}`]));
  const departmentNames = new Map(departments.map((department) => [department.id, `${department.code} — ${department.name}`]));
  const allSelected = courses.length > 0 && courses.every((course) => selectedCourses.includes(course.id));

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administration</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Administration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Courses</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Create and maintain courses, then assign a lecturer to one or multiple courses.</p>
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
          <h2 className="font-semibold">{editing ? 'Edit course' : 'Add course'}</h2>
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
          <label className="block text-sm font-medium text-slate-700">
            Course title
            <input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Course code
            <input required maxLength={20} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Department
            <select required value={form.department_id} onChange={(event) => setForm({ ...form, department_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Choose a department</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Lecturer
            <select value={form.lecturer_id} onChange={(event) => setForm({ ...form, lecturer_id: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Not assigned</option>
              {lecturers.filter((lecturer) => lecturer.is_active).map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.first_name} {lecturer.last_name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Credits
            <input required type="number" min={1} max={30} value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || departments.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save course' : 'Add course'}
            </button>
            {editing && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>}
          </div>
        </form>

        <section aria-labelledby="course-list-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id="course-list-heading" className="font-semibold">Course catalogue</h2>
            <button type="button" onClick={() => setSelectedCourses(allSelected ? [] : courses.map((course) => course.id))} disabled={!courses.length} className="text-sm font-semibold text-blue-700 disabled:text-slate-400">
              {allSelected ? 'Clear selection' : 'Select all'}
            </button>
          </div>
          {assignmentError && <p role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{assignmentError}</p>}
          {loading ? <p role="status" className="p-6 text-center text-sm text-slate-500">Loading courses…</p> : courses.length ? (
            <>
              <ul className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <li key={course.id} className="flex flex-wrap items-center gap-3 p-4">
                    <input type="checkbox" checked={selectedCourses.includes(course.id)} onChange={() => toggleCourse(course.id)} aria-label={`Select ${course.code} ${course.title}`} className="size-4 rounded border-slate-300 text-blue-700" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{course.code} · {course.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{departmentNames.get(course.department_id) ?? `Department #${course.department_id}`} · {lecturerNames.get(course.lecturer_id ?? -1) ?? (course.lecturer_id ? `Lecturer #${course.lecturer_id}` : 'No lecturer assigned')}</p>
                    </div>
                    <button type="button" onClick={() => startEditing(course)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                    <button type="button" onClick={() => void deactivateCourse(course)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Deactivate</button>
                  </li>
                ))}
              </ul>
              <form onSubmit={assignSelectedCourses} className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-end">
                <label className="flex-1 text-sm font-medium text-slate-700">
                  Assign {selectedCourses.length || 'selected'} course{selectedCourses.length === 1 ? '' : 's'} to
                  <select value={bulkLecturerId} onChange={(event) => setBulkLecturerId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <option value="">Unassign lecturer</option>
                    {lecturers.filter((lecturer) => lecturer.is_active).map((lecturer) => <option key={lecturer.id} value={lecturer.id}>{lecturer.first_name} {lecturer.last_name}</option>)}
                  </select>
                </label>
                <button type="submit" disabled={assigning || selectedCourses.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                  {assigning ? 'Assigning…' : 'Apply assignment'}
                </button>
              </form>
            </>
          ) : <p className="p-6 text-center text-sm text-slate-500">No courses found.</p>}
        </section>
      </section>
    </section>
  );
}
