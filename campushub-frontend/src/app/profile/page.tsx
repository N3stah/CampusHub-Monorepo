'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import type { User } from '@/types';

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

  function updateField(field: keyof EditableProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <PortalShell>
      <section className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Account</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My profile</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Keep your contact and profile details up to date. Role and department assignments are managed by the school.</p>
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
        ) : (
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
        )}
      </section>
    </PortalShell>
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
