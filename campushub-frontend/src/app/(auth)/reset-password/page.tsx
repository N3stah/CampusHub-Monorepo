'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import { getPasswordStrength } from '@/lib/password';
import { Alert } from '@/components/ui';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const strength = getPasswordStrength(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/password/reset/confirm/', { uid, token, password });
      setComplete(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/[0.04] sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">{complete ? 'Password updated' : 'Choose a new password'}</h1>
      {complete ? (
        <div className="mt-5 space-y-5">
          <Alert tone="success">Your password has been changed. You can now sign in with your new password.</Alert>
          <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">Sign in</Link>
        </div>
      ) : !uid || !token ? (
        <div className="mt-5 space-y-5">
          <Alert tone="error">This password reset link is invalid or incomplete.</Alert>
          <Link href="/forgot-password" className="font-semibold text-blue-700 hover:text-blue-800">Request a new link</Link>
        </div>
      ) : (
        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">New password</label>
            <input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            {password && (
              <div className="mt-2">
                <div className="flex gap-1">{[1, 2, 3, 4].map((level) => <span key={level} className={`h-1.5 flex-1 rounded-full ${level <= strength.score ? (strength.score >= 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200'}`} />)}</div>
                <p className="mt-1 text-xs text-slate-500">Password strength: {strength.label}</p>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
            <input id="confirm-password" type="password" minLength={8} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
          </div>
          <button type="submit" disabled={loading || password.length < 8} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Suspense fallback={<p role="status" className="text-sm text-slate-500">Loading reset form…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
