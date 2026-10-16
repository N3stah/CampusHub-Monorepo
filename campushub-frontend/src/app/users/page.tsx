'use client';

import { useState, type FormEvent } from 'react';
import api from '@/lib/api';
import DirectoryPage from '@/components/DirectoryPage';
import PortalShell from '@/components/PortalShell';
import { getApiErrorMessage, getDepartmentName } from '@/lib/portal';
import type { DirectoryUser } from '@/types/portal';
import { useAuth } from '@/context/AuthContext';

interface UserForm {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  role: DirectoryUser['role'];
  department: string;
  gpa: string;
  phone_number: string;
  password: string;
}

const emptyForm: UserForm = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  role: 'student',
  department: '',
  gpa: '',
  phone_number: '',
  password: '',
};

export default function UsersPage() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingUser, setEditingUser] = useState<DirectoryUser | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManageUsers = user?.role === 'admin';

  function openCreateForm() {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(account: DirectoryUser) {
    setEditingUser(account);
    setForm({
      first_name: account.first_name,
      last_name: account.last_name,
      email: account.email,
      username: account.username,
      role: account.role,
      department: typeof account.department === 'number' ? String(account.department) : '',
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
    const { password, department, gpa, ...accountData } = form;
    const payload = {
      ...accountData,
      department: department ? Number(department) : null,
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
    <PortalShell roles={['admin', 'officer']}>
      <div className="space-y-4">
        {notice && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
          </div>
        )}
        {formError && !isFormOpen && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>}
        <DirectoryPage<DirectoryUser>
          title={canManageUsers ? 'User accounts' : 'Students'}
          description={canManageUsers
            ? 'Create and manage student, lecturer, placement officer, and administrator accounts.'
            : 'Find student accounts and review their department, GPA, and account status.'}
          endpoint="/users/"
          searchPlaceholder="Search by name, email, or username"
          emptyMessage="No user accounts found. Try changing your search."
          refreshKey={refreshKey}
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
            { label: 'Email', render: (account) => <span className="text-slate-600">{account.email}</span> },
            {
              label: 'Role',
              render: (account) => <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold capitalize text-blue-800">{account.role === 'officer' ? 'Placement officer' : account.role}</span>,
            },
            { label: 'Department', render: (account) => <span className="text-slate-600">{getDepartmentName(account.department)}</span> },
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
        />
      </div>

      {isFormOpen && canManageUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="user-dialog-title" className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="user-dialog-title" className="text-xl font-bold">{editingUser ? 'Edit user account' : 'Create user account'}</h2>
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
                <label className="text-sm font-medium text-slate-700">Role
                  <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserForm['role'] })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="officer">Placement officer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                {!editingUser && (
                  <label className="text-sm font-medium text-slate-700">Initial password
                    <input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                  </label>
                )}
                <label className="text-sm font-medium text-slate-700">Department ID (optional)
                  <input type="number" min="1" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                </label>
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
