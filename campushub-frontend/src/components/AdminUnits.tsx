'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit, Course, DirectoryUser } from '@/types/portal';

type Department = { id: number; name: string; code: string; school__name: string };
type UnitForm = {
  code: string;
  title: string;
  credits: string;
  description: string;
  department_ids: number[];
  course_ids: number[];
};

const emptyForm: UnitForm = {
  code: '',
  title: '',
  credits: '3',
  description: '',
  department_ids: [],
  course_ids: [],
};

export default function AdminUnits() {
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<DirectoryUser[]>([]);
  const [form, setForm] = useState<UnitForm>(emptyForm);
  const [editing, setEditing] = useState<AcademicUnit | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [assignmentCourseId, setAssignmentCourseId] = useState('');
  const [assignmentLecturerIds, setAssignmentLecturerIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      getApiPage<AcademicUnit>('/academics/units/', { include_inactive: 'true' }, signal),
      getApiPage<Department>('/academics/departments/', {}, signal),
      getApiPage<Course>('/academics/courses/', { include_inactive: 'true' }, signal),
      getApiPage<DirectoryUser>('/lecturers/', {}, signal),
    ]);
    if (signal?.aborted) return;
    if (results[0].status === 'fulfilled') {
      const rows = results[0].value.results;
      setUnits(rows);
      setSelectedUnitId((current) => current && rows.some((unit) => unit.id === current)
        ? current
        : rows[0]?.id ?? null);
    }
    if (results[1].status === 'fulfilled') setDepartments(results[1].value.results);
    if (results[2].status === 'fulfilled') setCourses(results[2].value.results);
    if (results[3].status === 'fulfilled') setLecturers(results[3].value.results);
    const labels = ['Units', 'Departments', 'Programmes', 'Lecturers'];
    const errors = results.flatMap((result, index) => result.status === 'rejected'
      ? [`${labels[index]}: ${getApiErrorMessage(result.reason)}`]
      : []);
    setError(errors.length ? errors.join(' ') : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadData(controller.signal));
    return () => controller.abort();
  }, [loadData]);

  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? null;
  function toggleId(values: number[], id: number): number[] {
    return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
  }

  function editUnit(unit: AcademicUnit) {
    setEditing(unit);
    setForm({
      code: unit.code,
      title: unit.title,
      credits: String(unit.credits),
      description: unit.description,
      department_ids: unit.department_ids,
      course_ids: unit.course_ids,
    });
    setError(null);
    setNotice(null);
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.department_ids.length) {
      setError('Select at least one department responsible for this unit.');
      return;
    }
    const removedAssignments = editing?.offerings.filter((offering) => (
      !form.course_ids.includes(offering.course_id) && offering.lecturers.length > 0
    )) ?? [];
    if (removedAssignments.length && !window.confirm(
      `Removing this unit from ${removedAssignments.map((offering) => offering.course_code).join(', ')} will also remove those lecturer assignments. Continue?`,
    )) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      credits: Number(form.credits),
      description: form.description.trim(),
      department_ids: form.department_ids,
      course_ids: form.course_ids,
    };
    try {
      if (editing) {
        await api.patch(`/academics/units/${editing.id}/`, payload);
        setNotice('Unit details and programme links updated.');
      } else {
        await api.post('/academics/units/', payload);
        setNotice('Unit added to the catalogue.');
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateUnit(unit: AcademicUnit) {
    if (!window.confirm(`Deactivate ${unit.code} — ${unit.title}? Existing records are retained.`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/academics/units/${unit.id}/`);
      setNotice(`${unit.code} deactivated.`);
      await loadData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function reactivateUnit(unit: AcademicUnit) {
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/academics/units/${unit.id}/`, { is_active: true });
      setNotice(`${unit.code} reactivated.`);
      await loadData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  function chooseOffering(courseId: string) {
    setAssignmentCourseId(courseId);
    const offering = selectedUnit?.offerings.find((item) => item.course_id === Number(courseId));
    setAssignmentLecturerIds(offering?.lecturers.map((lecturer) => lecturer.id) ?? []);
  }

  async function saveTeachingAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUnit || !assignmentCourseId) return;
    setAssigning(true);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/academics/units/${selectedUnit.id}/teaching-assignments/`, {
        course_id: Number(assignmentCourseId),
        lecturer_ids: assignmentLecturerIds,
      });
      setNotice('Teaching assignments saved.');
      await loadData();
      setAssignmentCourseId(String(Number(assignmentCourseId)));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administration</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Academic structure</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Units and teaching</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A unit is a shared subject, not a programme. Link it to multiple departments and programmes, then assign one or more lecturers to each programme offering.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
        <form onSubmit={saveUnit} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{editing ? 'Edit unit' : 'Add unit'}</h2>
              <p className="mt-1 text-xs text-slate-500">The same unit can belong to more than one department and programme.</p>
            </div>
            {editing && <button type="button" onClick={resetForm} className="text-xs font-semibold text-slate-600 underline">Cancel</button>}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Unit code
            <input required maxLength={30} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Unit title
            <input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Credit hours
            <input required type="number" min={1} max={30} value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700">Coordinating departments</legend>
            <p className="text-xs text-slate-500">Select every department that owns or coordinates this shared unit.</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {departments.map((department) => (
                <label key={department.id} className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={form.department_ids.includes(department.id)} onChange={() => setForm({ ...form, department_ids: toggleId(form.department_ids, department.id) })} className="mt-0.5 rounded border-slate-300 text-blue-700" />
                  <span>{department.school__name} / {department.code} — {department.name}</span>
                </label>
              ))}
              {!departments.length && <p className="p-2 text-xs text-slate-500">Create a school and department first.</p>}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700">Programmes offering this unit</legend>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {courses.map((course) => (
                <label key={course.id} className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={form.course_ids.includes(course.id)} disabled={!course.is_active && !form.course_ids.includes(course.id)} onChange={() => setForm({ ...form, course_ids: toggleId(form.course_ids, course.id) })} className="mt-0.5 rounded border-slate-300 text-blue-700" />
                  <span>{course.code} — {course.title}{!course.is_active && <span className="ml-1 text-xs text-amber-700">(inactive)</span>}<span className="block text-xs text-slate-500">{course.school_name} / {course.department_name}</span></span>
                </label>
              ))}
              {!courses.length && <p className="p-2 text-xs text-slate-500">Create a programme first. Units can also be added to programmes later.</p>}
            </div>
          </fieldset>

          <button type="submit" disabled={saving || !departments.length} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save unit' : 'Add unit'}
          </button>
        </form>

        <section aria-labelledby="unit-catalogue-heading" className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 id="unit-catalogue-heading" className="font-semibold">Unit catalogue</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{units.length}</span>
            </div>
            {loading ? <p role="status" className="p-6 text-sm text-slate-500">Loading units…</p> : units.length ? (
              <ul className="divide-y divide-slate-100">
                {units.map((unit) => (
                  <li key={unit.id} className={`p-4 ${unit.id === selectedUnitId ? 'bg-blue-50/50' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" onClick={() => { setSelectedUnitId(unit.id); setAssignmentCourseId(''); setAssignmentLecturerIds([]); }} aria-pressed={unit.id === selectedUnitId} className="min-w-0 flex-1 text-left">
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-700">{unit.code} · {unit.credits} credits</span>
                        <span className="mt-1 block font-semibold text-slate-900">{unit.title}</span>
                        <span className="mt-1 block text-xs text-slate-500">{unit.departments.map((department) => `${department.code} — ${department.name}`).join(' · ')}</span>
                      </button>
                      <div className="flex gap-2">
                        {!unit.is_active && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Inactive</span>}
                        <button type="button" onClick={() => editUnit(unit)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</button>
                        {unit.is_active
                          ? <button type="button" onClick={() => void deactivateUnit(unit)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Deactivate</button>
                          : <button type="button" onClick={() => void reactivateUnit(unit)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">Reactivate</button>}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {unit.offerings.length
                        ? unit.offerings.map((offering) => `${offering.course_code}${offering.is_active ? '' : ' (inactive programme)'}: ${offering.lecturers.map((lecturer) => lecturer.name).join(', ') || 'No lecturer assigned'}`).join(' · ')
                        : 'Not currently offered in a programme'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : <p className="p-6 text-sm text-slate-500">No units yet. Add a unit and link it to the departments and programmes where it is taught.</p>}
          </div>

          {selectedUnit?.is_active && selectedUnit.offerings.some((offering) => offering.is_active) && (
            <form onSubmit={saveTeachingAssignment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="font-semibold">Assign lecturers</h2>
                <p className="mt-1 text-sm text-slate-500">Assignments are specific to a unit within a programme. A lecturer can teach units across any department or programme.</p>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Programme offering
                <select required value={assignmentCourseId} onChange={(event) => chooseOffering(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="">Choose a programme</option>
                  {selectedUnit.offerings.filter((offering) => offering.is_active).map((offering) => <option key={offering.course_id} value={offering.course_id}>{offering.course_code} — {offering.course_title}</option>)}
                </select>
              </label>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-700">Lecturers</legend>
                <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                  {lecturers.filter((lecturer) => lecturer.is_active).map((lecturer) => (
                    <label key={lecturer.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={assignmentLecturerIds.includes(lecturer.id)} onChange={() => setAssignmentLecturerIds((current) => toggleId(current, lecturer.id))} className="rounded border-slate-300 text-blue-700" />
                      {lecturer.first_name} {lecturer.last_name}
                    </label>
                  ))}
                  {!lecturers.some((lecturer) => lecturer.is_active) && <p className="p-2 text-xs text-slate-500">Create active lecturer accounts first.</p>}
                </div>
              </fieldset>
              <button type="submit" disabled={assigning || !assignmentCourseId} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{assigning ? 'Saving…' : 'Save lecturer assignments'}</button>
            </form>
          )}
        </section>
      </div>
    </section>
  );
}
