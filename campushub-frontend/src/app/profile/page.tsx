'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { User } from '@/types';
import type { Enrollment, Placement, StudentApplication } from '@/types/portal';

type EditableProfile = Pick<User, 'first_name' | 'last_name'> & {
  phone_number: string;
  title: string;
  bio: string;
  office_hours: string;
};

const emptyProfile: EditableProfile = {
  first_name: '',
  last_name: '',
  phone_number: '',
  title: '',
  bio: '',
  office_hours: '',
};

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<EditableProfile>(emptyProfile);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<EditableProfile>('/auth/me/', { signal });
      setProfile({
        first_name: response.data.first_name ?? '',
        last_name: response.data.last_name ?? '',
        phone_number: response.data.phone_number ?? '',
        title: response.data.title ?? '',
        bio: response.data.bio ?? '',
        office_hours: response.data.office_hours ?? '',
      });
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadProfile(controller.signal));
    return () => controller.abort();
  }, [loadProfile]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.patch<User & { updated?: string[] }>('/auth/me/', profile);
      updateUser(response.data);
      setProfile({
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        phone_number: response.data.phone_number ?? '',
        title: response.data.title ?? '',
        bio: response.data.bio ?? '',
        office_hours: response.data.office_hours ?? '',
      });
      setNotice('Your profile was saved.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      setSaving(false);
      return;
    }

    try {
      await api.patch('/auth/me/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Your password was changed.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EditableProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <PortalShell>
      <section className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My profile</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {user?.role === 'officer'
              ? 'Your account details are managed by your administrator. You can update your password below.'
              : 'Keep your contact and profile details up to date. Role and department assignments are managed by the school.'}
          </p>
        </header>

        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" onClick={() => { setLoading(true); void loadProfile(); }} className="mt-2 font-semibold underline">Try again</button>
          </div>
        )}

        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading your profile…</p>
        ) : user?.role === 'officer' ? (
          <div className="space-y-5">
            <section aria-label="Profile details" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Profile details</h2>
              <p className="mt-1 text-sm text-slate-500">Contact information is maintained by your administrator.</p>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <ReadOnlyField label="Name" value={`${profile.first_name} ${profile.last_name}`.trim()} />
                <ReadOnlyField label="Professional title" value={profile.title} />
                <ReadOnlyField label="Phone number" value={profile.phone_number} />
                <ReadOnlyField label="Email" value={user.email} />
                <ReadOnlyField label="Username" value={user.username} />
                <ReadOnlyField label="Department" value={user.department ? String(user.department) : 'Managed by your school'} />
              </dl>
            </section>
            <form onSubmit={(event) => void changePassword(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold">Change password</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a strong password that you do not use elsewhere.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Current password
                  <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  New password
                  <input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Confirm new password
                  <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
              </div>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            {user?.role === 'student' && <StudentProfileSummary />}
            <form onSubmit={(event) => void saveProfile(event)} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <section aria-label="Account information" className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Email" value={user?.email ?? ''} />
              <ReadOnlyField label="Username" value={user?.username ?? ''} />
              <ReadOnlyField label="Role" value={user?.role ?? ''} />
              <ReadOnlyField label="Department" value={user?.department ? String(user.department) : 'Managed by your school'} />
            </section>
            <div className="border-t border-slate-100 pt-5">
              <h2 className="font-semibold">Contact and profile</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  First name
                  <input required maxLength={100} value={profile.first_name} onChange={(event) => updateField('first_name', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Last name
                  <input required maxLength={100} value={profile.last_name} onChange={(event) => updateField('last_name', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Phone number
                  <input type="tel" maxLength={20} value={profile.phone_number} onChange={(event) => updateField('phone_number', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Professional title
                  <input maxLength={100} value={profile.title} onChange={(event) => updateField('title', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  About
                  <textarea rows={4} value={profile.bio} onChange={(event) => updateField('bio', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                </label>
                {user?.role === 'lecturer' && (
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                    Office hours
                    <input maxLength={200} value={profile.office_hours} onChange={(event) => updateField('office_hours', event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="e.g. Tuesdays, 10:00–12:00" />
                  </label>
                )}
              </div>
            </div>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            </form>
          </div>
        )}
      </section>
    </PortalShell>
  );
}

function StudentProfileSummary() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [placementCount, setPlacementCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    try {
      const [enrollmentPage, applicationPage, placementPage] = await Promise.all([
        getApiPage<Enrollment>('/academics/enrollments/', {}, signal),
        getApiPage<StudentApplication>('/applications/', {}, signal),
        getApiPage<Placement>('/placements/', { is_active: 'true' }, signal),
      ]);
      if (signal?.aborted) return;
      setEnrollments(enrollmentPage.results);
      setApplications(applicationPage.results);
      setPlacementCount(placementPage.count);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadSummary(controller.signal));
    return () => controller.abort();
  }, [loadSummary]);

  const activeCourses = enrollments.filter((enrollment) => enrollment.status === 'active').length;
  const applicationStatuses = ['pending', 'shortlisted', 'accepted', 'rejected'] as const;

  return (
    <section aria-labelledby="student-profile-summary-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="student-profile-summary-heading" className="font-semibold">Student overview</h2>
          <p className="mt-1 text-sm text-slate-500">A quick summary of your learning and applications.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/courses" className="font-semibold text-blue-700 hover:underline">Courses</Link>
          <Link href="/applications" className="font-semibold text-blue-700 hover:underline">Applications</Link>
        </div>
      </div>
      {error ? (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3">
          <p role="alert" className="text-sm text-red-800">{error}</p>
          <button type="button" onClick={() => { setLoading(true); void loadSummary(); }} className="mt-1 text-sm font-semibold text-red-900 underline">Try again</button>
        </div>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Active courses', value: loading ? null : activeCourses, href: '/courses' },
              { label: 'Applications', value: loading ? null : applications.length, href: '/applications' },
              { label: 'Open placements', value: loading ? null : placementCount, href: '/placements' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
                <dd className="mt-1">
                  <Link href={item.href} className="text-xl font-bold text-slate-900 hover:text-blue-700">
                    {item.value ?? <span className="text-sm font-medium text-slate-400">Loading…</span>}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
            {applicationStatuses.map((status) => (
              <p key={status} className="text-xs text-slate-600">
                <span className="font-semibold capitalize">{status}:</span>{' '}
                {loading ? '…' : applications.filter((application) => application.status === status).length}
              </p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize text-slate-800">{value || '—'}</p>
    </div>
  );
}
