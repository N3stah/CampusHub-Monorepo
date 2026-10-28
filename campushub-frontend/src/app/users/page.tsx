'use client';

import { useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import DirectoryPage from '@/components/DirectoryPage';
import PortalShell from '@/components/PortalShell';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, DirectoryUser } from '@/types/portal';
import { useAuth } from '@/context/AuthContext';

interface UserForm {
  first_name: string;
  last_name: string;
  admission_number: string;
  email: string;
  username: string;
  programme_id: string;
  role: DirectoryUser['role'];
  gpa: string;
  phone_number: string;
  password: string;
}

const emptyForm: UserForm = {
  first_name: '',
  last_name: '',
  admission_number: '',
  email: '',
  username: '',
  programme_id: '',
  role: 'student',
  gpa: '',
  phone_number: '',
  password: '',
};

const roleFilters: Record<string, Record<string, string>> = {
  student: { role: 'student' },
  officer: { role: 'officer' },
};

export default function UsersPage() {
  const { user } = useAuth();
  const [programmes, setProgrammes] = useState<Course[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingUser, setEditingUser] = useState<DirectoryUser | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('student');
  const [roleInitialized, setRoleInitialized] = useState(false);
  const canManageUsers = user?.role === 'admin';
  const selectedProgramme = programmes.find((programme) => String(programme.id) === form.programme_id);

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get('role') ?? '';
    void Promise.resolve().then(() => {
      setRoleFilter(requestedRole === 'officer' ? 'officer' : 'student');
      setRoleInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const controller = new AbortController();
    void getApiPage<Course>('/academics/courses/', { include_inactive: 'true' }, controller.signal).then((programmePage) => {
      if (controller.signal.aborted) return;
      setProgrammes(programmePage.results);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setFormError(getApiErrorMessage(error));
    });
    return () => controller.abort();
  }, [user?.role]);

  function openCreateForm() {
    setEditingUser(null);
    setForm({ ...emptyForm, role: roleFilter === 'officer' ? 'officer' : 'student' });
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(account: DirectoryUser) {
    setEditingUser(account);
    setForm({
      first_name: account.first_name,
      last_name: account.last_name,
      admission_number: account.admission_number ?? '',
      email: account.email,
      username: account.username,
      programme_id: account.programme_id ? String(account.programme_id) : '',
      role: account.role,
      gpa: account.gpa ?? '',
      phone_number: account.phone_number ?? '',
      password: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const { password, programme_id, gpa, ...accountData } = form;
    const payload = {
      ...accountData,
      ...(form.role === 'student' ? { course_id: Number(programme_id) } : {}),
      gpa: gpa || null,
      ...(password ? { password } : {}),
    };
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}/`, payload);
        setNotice('User account updated.');
      } else {
        await api.post('/users/', { ...payload, password });
        setNotice('User account created. They can now sign in with their email and password.');
      }
      setEditingUser(null);
      setIsFormOpen(false);
      setForm(emptyForm);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function setAccountActive(account: DirectoryUser, isActive: boolean) {
    if (!isActive && !window.confirm(`Deactivate ${account.first_name} ${account.last_name}?`)) return;
    setFormError(null);
    try {
      await api.patch(`/users/${account.id}/`, { is_active: isActive });
      setNotice(`User account ${isActive ? 'reactivated' : 'deactivated'}.`);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  return (
    <PortalShell roles={['admin']}>
      <div className="space-y-4">
        {!roleInitialized && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading directory…</p>}
        {notice && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
          </div>
        )}
        {formError && !isFormOpen && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>}
        {roleInitialized && <DirectoryPage<DirectoryUser>
          title={roleFilter === 'officer' ? 'Placement officers' : 'Students'}
          description={roleFilter === 'officer'
            ? 'Manage placement officer accounts.'
            : 'Find and manage students by their unique admission number.'}
          endpoint="/users/"
          searchPlaceholder={roleFilter === 'student' ? 'Search by admission number or name' : 'Search by name, email, or username'}
          emptyMessage="No user accounts found. Try changing your search."
          refreshKey={refreshKey}
          filters={roleFilters[roleFilter]}
          getKey={(account) => account.id}
          headerAction={canManageUsers ? (
            <button type="button" onClick={openCreateForm} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
              Add user
            </button>
          ) : undefined}
          actionColumn={canManageUsers ? {
            label: 'Actions',
            render: (account) => account.id === user?.id ? (
              <span className="text-xs text-slate-500">Current account</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openEditForm(account)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                <button
                  type="button"
                  onClick={() => void setAccountActive(account, !account.is_active)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${account.is_active ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                >
                  {account.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            ),
          } : undefined}
          columns={[
            {
              label: 'User',
              render: (account) => (
                <div>
                  <p className="font-semibold text-slate-900">{account.first_name} {account.last_name}</p>
                  <p className="mt-1 text-xs text-slate-500">{account.username}</p>
                </div>
              ),
            },
            { label: 'Admission number', render: (account) => <span className="font-medium text-slate-700">{account.admission_number || '—'}</span> },
            { label: 'Email', render: (account) => <span className="text-slate-600">{account.email}</span> },
            {
              label: 'Role',
              render: (account) => <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold capitalize text-blue-800">{account.role === 'officer' ? 'Placement officer' : account.role}</span>,
            },
            {
              label: 'Programme',
              render: (account) => (
                <div>
                  <span className="font-medium text-slate-800">
                    {account.programme_code && account.programme_title
                      ? `${account.programme_code} — ${account.programme_title}`
                      : 'Not assigned'}
                  </span>
                  {account.school_name && account.department_name && (
                    <span className="block text-xs text-slate-500">{account.school_name} / {account.department_name}</span>
                  )}
                  {account.programme_status === 'completed' && (
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Completed</span>
                  )}
                </div>
              ),
            },
            { label: 'GPA', render: (account) => <span className="text-slate-600">{account.gpa ?? '—'}</span> },
            {
              label: 'Status',
              render: (account) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
          ]}
        />}
      </div>

      {isFormOpen && canManageUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="user-dialog-title" className="text-xl font-bold">
                  {editingUser ? `Edit ${roleFilter === 'student' ? 'student' : 'placement officer'} account` : `Create ${roleFilter === 'student' ? 'student' : 'placement officer'} account`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Assign the account role used to control CampusHub access.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => { setIsFormOpen(false); setEditingUser(null); }} aria-label="Close dialog" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            {formError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
            <form onSubmit={saveUser} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">First name
                  <input required autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-medium text-slate-700">Last name
                  <input required autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-medium text-slate-700">Email
                  <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-medium text-slate-700">Username
                  <input required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
                <input type="hidden" name="role" value={form.role} />
                {form.role === 'student' && (
                  <label className="text-sm font-medium text-slate-700">Admission / registration number
                    <input
                      required
                      maxLength={30}
                      placeholder="e.g. 23/08181"
                      value={form.admission_number}
                      onChange={(event) => setForm({ ...form, admission_number: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                    />
                  </label>
                )}
                {!editingUser && (
                  <label className="text-sm font-medium text-slate-700">Initial password
                    <input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                )}
                {form.role === 'student' && (
                  <label className="text-sm font-medium text-slate-700">Programme
                    <select required value={form.programme_id} onChange={(event) => setForm({ ...form, programme_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                      <option value="">Choose one programme</option>
                      {programmes.filter((programme) => (
                        (programme.is_active && programme.school_code !== 'UNASSIGNED')
                        || String(programme.id) === form.programme_id
                      )).map((programme) => (
                        <option key={programme.id} value={programme.id}>
                          {programme.code} — {programme.title}{programme.is_active ? '' : ' (inactive)'}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {selectedProgramme
                        ? `${selectedProgramme.school_name ?? ''} / ${selectedProgramme.department_name ?? ''} — assigned automatically`
                        : 'The programme determines the student’s school and department.'}
                    </span>
                  </label>
                )}
                {form.role === 'student' && (
                  <label className="text-sm font-medium text-slate-700">GPA (optional)
                    <input type="number" min="0" max="4" step="0.01" value={form.gpa} onChange={(event) => setForm({ ...form, gpa: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                )}
                <label className="text-sm font-medium text-slate-700">Phone (optional)
                  <input type="tel" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
              </div>
              {editingUser && (
                <label className="block text-sm font-medium text-slate-700">New password (leave blank to keep current)
                  <input type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
              )}
              <button disabled={saving} type="submit" className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? 'Saving…' : editingUser ? 'Save changes' : 'Create account'}
              </button>
            </form>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
