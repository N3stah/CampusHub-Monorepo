'use client';

import { useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import DirectoryPage from '@/components/DirectoryPage';
import PortalShell from '@/components/PortalShell';
import { getApiErrorMessage, getApiPage, getDepartmentName } from '@/lib/portal';
import type { Lecturer, School } from '@/types/portal';
import { useAuth } from '@/context/AuthContext';

interface LecturerForm {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  school_id: string;
  department: string;
  title: string;
  bio: string;
  office_hours: string;
  password: string;
}

const emptyForm: LecturerForm = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  school_id: '',
  department: '',
  title: '',
  bio: '',
  office_hours: '',
  password: '',
};

export default function LecturersPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [departments, setDepartments] = useState<{ id: number; code: string; name: string; school_id: number; school__name: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<LecturerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManageLecturers = user?.role === 'admin';

  useEffect(() => {
    if (!canManageLecturers) return;
    let active = true;
    void Promise.all([
      getApiPage<School>('/academics/schools/', {}),
      getApiPage<{ id: number; code: string; name: string; school_id: number; school__name: string }>('/academics/departments/', {}),
    ]).then(([schoolPage, departmentPage]) => {
      if (!active) return;
      setSchools(schoolPage.results);
      setDepartments(departmentPage.results);
    }).catch((error: unknown) => {
      if (active) setFormError(getApiErrorMessage(error));
    });
    return () => { active = false; };
  }, [canManageLecturers]);

  function openCreateForm() {
    setEditingLecturer(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(lecturer: Lecturer) {
    const departmentId = typeof lecturer.department === 'number' ? lecturer.department : 0;
    const department = departments.find((item) => item.id === departmentId);
    setEditingLecturer(lecturer);
    setForm({
      first_name: lecturer.first_name,
      last_name: lecturer.last_name,
      email: lecturer.email,
      username: lecturer.username,
      school_id: department ? String(department.school_id) : '',
      department: departmentId ? String(departmentId) : '',
      title: lecturer.title ?? '',
      bio: lecturer.bio ?? '',
      office_hours: lecturer.office_hours ?? '',
      password: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function saveLecturer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const { password, school_id, department, ...lecturerData } = form;
    void school_id;
    const payload = {
      ...lecturerData,
      role: 'lecturer',
      department: department ? Number(department) : null,
      ...(password ? { password } : {}),
    };

    try {
      if (editingLecturer) {
        await api.patch(`/lecturers/${editingLecturer.id}/`, payload);
        setNotice('Lecturer details updated.');
      } else {
        await api.post('/lecturers/', { ...payload, password });
        setNotice('Lecturer account created.');
      }
      setEditingLecturer(null);
      setIsFormOpen(false);
      setForm(emptyForm);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateLecturer(lecturer: Lecturer) {
    if (!window.confirm(`Deactivate ${lecturer.first_name} ${lecturer.last_name}?`)) return;
    setFormError(null);
    try {
      await api.patch(`/lecturers/${lecturer.id}/`, { is_active: false });
      setNotice('Lecturer account deactivated.');
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  async function reactivateLecturer(lecturer: Lecturer) {
    setFormError(null);
    try {
      await api.patch(`/lecturers/${lecturer.id}/`, { is_active: true });
      setNotice('Lecturer account reactivated.');
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  return (
    <PortalShell roles={['admin']}>
      <div className="space-y-4">
        {notice && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
          </div>
        )}
        {formError && !isFormOpen && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>
        )}
        <DirectoryPage<Lecturer>
          title="Lecturers"
          description="Browse lecturer contacts and their home departments. Teaching assignments are managed per programme unit."
          endpoint="/lecturers/"
          searchPlaceholder="Search by name, email, or course"
          emptyMessage="No lecturers found. Try changing your search."
          refreshKey={refreshKey}
          getKey={(lecturer) => lecturer.id}
          headerAction={canManageLecturers ? (
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Add lecturer
            </button>
          ) : undefined}
          actionColumn={canManageLecturers ? {
            label: 'Actions',
            render: (lecturer) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(lecturer)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
                {lecturer.is_active ? (
                  <button
                    type="button"
                    onClick={() => void deactivateLecturer(lecturer)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void reactivateLecturer(lecturer)}
                    className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            ),
          } : undefined}
          columns={[
            {
              label: 'Lecturer',
              render: (lecturer) => (
                <div>
                  <p className="font-semibold text-slate-900">{lecturer.first_name} {lecturer.last_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{lecturer.title ?? 'Lecturer'}</p>
                </div>
              ),
            },
            { label: 'Email', render: (lecturer) => <span className="text-slate-600">{lecturer.email}</span> },
            { label: 'School / department', render: (lecturer) => <span className="text-slate-600">{lecturer.school_name && lecturer.department_name ? `${lecturer.school_name} / ${lecturer.department_name}` : getDepartmentName(lecturer.department)}</span> },
            {
              label: 'Courses',
              render: (lecturer) => (
                <span className="text-slate-600">
                  {lecturer.courses?.length
                    ? lecturer.courses.map((course) => typeof course === 'string' ? course : course.name).join(', ')
                    : '—'}
                </span>
              ),
            },
            {
              label: 'Account',
              render: (lecturer) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lecturer.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {lecturer.is_active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
          ]}
        />
      </div>

      {isFormOpen && canManageLecturers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lecturer-dialog-title"
            className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="lecturer-dialog-title" className="text-xl font-bold">
                  {editingLecturer ? 'Edit lecturer' : 'Add lecturer'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Create or update lecturer profile and contact details.</p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => { setIsFormOpen(false); setEditingLecturer(null); setFormError(null); }}
                aria-label="Close dialog"
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            {formError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
            <form onSubmit={saveLecturer} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">First name
                  <input required autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="text-sm font-medium text-slate-700">Last name
                  <input required autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="text-sm font-medium text-slate-700">Email
                  <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="text-sm font-medium text-slate-700">Username
                  <input required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                {!editingLecturer && (
                  <label className="text-sm font-medium text-slate-700">Initial password
                    <input required type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                  </label>
                )}
                <label className="text-sm font-medium text-slate-700">School
                  <select required value={form.school_id} onChange={(event) => setForm({ ...form, school_id: event.target.value, department: '' })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                    <option value="">Choose school</option>
                    {schools.filter((school) => school.code !== 'UNASSIGNED').map((school) => <option key={school.id} value={school.id}>{school.code} — {school.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Home department
                  <select required value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                    <option value="">Choose department</option>
                    {departments.filter((department) => String(department.school_id) === form.school_id).map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Job title
                  <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="text-sm font-medium text-slate-700">Office hours
                  <input value={form.office_hours} onChange={(event) => setForm({ ...form, office_hours: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">Bio
                <textarea rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              </label>
              <button disabled={saving} type="submit" className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? 'Saving…' : editingLecturer ? 'Save changes' : 'Create lecturer'}
              </button>
            </form>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
