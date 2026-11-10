'use client';

import { useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import DirectoryPage from '@/components/DirectoryPage';
import PortalShell from '@/components/PortalShell';
import { getApiErrorMessage } from '@/lib/portal';
import type { DirectoryUser } from '@/types/portal';
import { useAuth } from '@/context/AuthContext';
import { manageableAccountRoles, roleLabels, type ManagedAccountRole } from '@/lib/role-access';

interface UserForm {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  role: ManagedAccountRole;
  phone_number: string;
}

const emptyForm: UserForm = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  role: 'lecturer',
  phone_number: '',
};

const roleFilters: Record<ManagedAccountRole, Record<string, string>> = {
  lecturer: { role: 'lecturer' },
  officer: { role: 'officer' },
  admin: { role: 'admin' },
  ict_admin: { role: 'ict_admin' },
  registrar: { role: 'registrar' },
  finance: { role: 'finance' },
  librarian: { role: 'librarian' },
  hostel: { role: 'hostel' },
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
  const [noticeKind, setNoticeKind] = useState<'success' | 'warning'>('success');
  const [resendingInvitationId, setResendingInvitationId] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<ManagedAccountRole>('lecturer');
  const [roleInitialized, setRoleInitialized] = useState(false);
  const canManageUsers = user?.role === 'admin';

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get('role') ?? '';
    void Promise.resolve().then(() => {
      setRoleFilter(manageableAccountRoles.find((role) => role === requestedRole) ?? 'lecturer');
      setRoleInitialized(true);
    });
  }, []);

  function openCreateForm() {
    setEditingUser(null);
    setForm({ ...emptyForm, role: roleFilter });
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
      role: manageableAccountRoles.find((role) => role === account.role) ?? 'lecturer',
      phone_number: account.phone_number ?? '',
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    const payload = { ...form };
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}/`, payload);
        setNotice('User account updated.');
        setNoticeKind('success');
      } else {
        if (!window.confirm(`Create this ${roleLabels[form.role]} account and send initial sign-in instructions to ${form.email}?`)) return;
        const { data } = await api.post<{ welcome_email_status?: string }>('/users/', { ...payload, send_welcome_email: true });
        if (data.welcome_email_status === 'sent' || data.welcome_email_status === 'queued') {
          setNotice('User account created and initial sign-in email sent.');
          setNoticeKind('success');
        } else {
          setNotice('The account was created, but email delivery was not confirmed. Do not submit the form again; ask an administrator to check delivery and resend the invitation.');
          setNoticeKind('warning');
        }
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
      setNoticeKind('success');
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  async function resendInvitation(account: DirectoryUser) {
    if (!window.confirm(`Send a new temporary password to ${account.email}? This will replace the user's current password and require a password change at next sign-in.`)) return;
    setResendingInvitationId(account.id);
    setFormError(null);
    setNotice(null);
    try {
      const { data } = await api.post<{ welcome_email_status: 'sent' | 'failed' }>(`/users/${account.id}/resend-invitation/`);
      if (data.welcome_email_status === 'sent') {
        setNotice(`A new initial sign-in email was submitted for ${account.email}.`);
        setNoticeKind('success');
      } else {
        setNotice(`Email delivery failed for ${account.email}. Check the Gmail SMTP configuration and retry. The password was not shown.`);
        setNoticeKind('warning');
      }
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setResendingInvitationId(null);
    }
  }

  return (
    <PortalShell roles={['admin']}>
      <div className="space-y-4">
        {!roleInitialized && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading directory…</p>}
        {notice && (
          <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${noticeKind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="font-semibold">Dismiss</button>
          </div>
        )}
        {formError && !isFormOpen && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>}
        {roleInitialized && (
          <section className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-semibold text-slate-900">Accounts and role assignments</h1>
              <p className="mt-1 text-sm text-slate-600">Create staff accounts and assign roles. New accounts receive a generated initial credential by email and must change it after signing in.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>Role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as ManagedAccountRole)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                {manageableAccountRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </select>
            </label>
          </section>
        )}
        {roleInitialized && <DirectoryPage<DirectoryUser>
          title={`${roleLabels[roleFilter]} accounts`}
          description="Manage staff account details, roles, and active status."
          endpoint="/users/"
          searchPlaceholder="Search by name, email, or username"
          emptyMessage="No user accounts found. Try changing your search."
          refreshKey={refreshKey}
          filters={roleFilters[roleFilter]}
          getKey={(account) => account.id}
          headerAction={canManageUsers ? (
            <button type="button" onClick={openCreateForm} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
              Add account
            </button>
          ) : undefined}
          actionColumn={canManageUsers ? {
            label: 'Actions',
            render: (account) => account.id === user?.id ? (
              <span className="text-xs text-slate-500">Current account</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openEditForm(account)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                {account.is_active && <button type="button" disabled={resendingInvitationId === account.id} onClick={() => void resendInvitation(account)} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{resendingInvitationId === account.id ? 'Sending…' : 'Resend sign-in email'}</button>}
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
                  <p className="mt-0.5 text-xs text-slate-500">{account.username}</p>
                </div>
              ),
            },
            { label: 'Email', render: (account: DirectoryUser) => <span className="text-slate-600">{account.email}</span> },
            {
              label: 'Status',
              render: (account: DirectoryUser) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              label: 'Invitation email',
              render: (account) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  account.invitation_email_status === 'sent'
                    ? 'bg-emerald-50 text-emerald-700'
                    : account.invitation_email_status === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {account.invitation_email_status === 'sent' ? 'Submitted' : account.invitation_email_status === 'failed' ? 'Failed' : 'Not sent'}
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
                  {editingUser ? 'Edit account' : 'Create account'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingUser ? 'Update account details. Users manage their passwords themselves.' : 'A secure initial password will be generated and emailed after you confirm.'}
                </p>
              </div>
              <button type="button" disabled={saving} onClick={() => { setIsFormOpen(false); setEditingUser(null); }} aria-label="Close dialog" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            {formError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
            <form onSubmit={saveUser} className="space-y-4">
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
                <label className="text-sm font-medium text-slate-700">Role
                  <select
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value as ManagedAccountRole })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  >
                    {manageableAccountRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Phone (optional)
                  <input type="tel" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>
              <button disabled={saving} type="submit" className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                {saving ? 'Saving…' : editingUser ? 'Save changes' : 'Create account'}
              </button>
            </form>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
