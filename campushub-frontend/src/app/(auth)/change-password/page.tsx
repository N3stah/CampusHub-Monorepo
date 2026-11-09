'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/portal';
import { getPasswordStrength } from '@/lib/password';
import api from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    if (password === currentPassword) {
      setError('Choose a password different from your temporary password.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/auth/password/change/', {
        current_password: currentPassword,
        new_password: password,
      });
      updateUser({ must_change_password: false });
      setComplete(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50"><p role="status" className="text-sm text-slate-500">Checking your account…</p></main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <Link href="/" className="text-xl font-bold text-slate-900">Campus<span className="text-blue-700">Hub</span></Link>
        <h1 className="mt-7 text-2xl font-bold text-slate-900">Set a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{user.must_change_password ? 'For your security, replace your initial password before continuing to CampusHub.' : 'Update your CampusHub password securely.'}</p>
        {complete ? (
          <div className="mt-5 space-y-4">
            <Alert tone="success">Password changed successfully. Your account is ready.</Alert>
            <button type="button" onClick={() => router.replace('/dashboard')} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">Continue to CampusHub</button>
          </div>
        ) : (
          <>
            {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}
            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
                Current / initial password
                <input id="current-password" type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3" />
              </label>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
                New password
                <input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3" />
                {password && <span className="mt-1 block text-xs text-slate-500">Password strength: {strength.label}</span>}
              </label>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
                Confirm new password
                <input id="confirm-password" type="password" minLength={8} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3" />
              </label>
              <button type="submit" disabled={saving || password.length < 8} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">
                {saving ? 'Updating password…' : 'Change password and continue'}
              </button>
            </form>
          </>
        )}
        {!complete && (
          <button type="button" onClick={logout} className="mt-4 w-full text-center text-sm font-semibold text-slate-600 hover:text-blue-700">Sign out</button>
        )}
      </section>
    </main>
  );
}
