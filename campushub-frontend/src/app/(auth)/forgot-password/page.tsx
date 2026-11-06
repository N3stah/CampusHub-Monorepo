'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import { Alert } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/password/reset/', { email: email.trim() });
      setSubmitted(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/[0.04] sm:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-slate-900">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">C</span>
          Campus<span className="-ml-2 text-blue-700">Hub</span>
        </Link>
        <h1 className="mt-7 text-2xl font-bold text-slate-900">Reset your password</h1>

        {submitted ? (
          <div className="mt-5 space-y-5">
            <Alert tone="success">
              If an account matches that email, a password reset link has been sent. Check your inbox and spam folder.
            </Alert>
            <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
            <p className="text-sm leading-6 text-slate-600">Enter your CampusHub email address and we will send you a reset link.</p>
            {error && <Alert tone="error">{error}</Alert>}
            <div>
              <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="you@campus.edu"
              />
            </div>
            <button type="submit" disabled={loading || !email.trim()} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">
              {loading ? 'Sending reset link…' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-slate-600">
              <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
