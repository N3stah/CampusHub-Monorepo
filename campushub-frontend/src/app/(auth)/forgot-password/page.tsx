'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import { Alert } from '@/components/ui';
import { getPasswordStrength } from '@/lib/password';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = getPasswordStrength(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!otpSent) {
        await api.post('/auth/password/otp/request/', { email: email.trim() });
        setOtpSent(true);
      } else {
        if (password !== confirmation) {
          setError('Passwords do not match.');
          return;
        }
        await api.post('/auth/password/otp/confirm/', {
          email: email.trim(),
          otp: otp.trim(),
          new_password: password,
        });
        setComplete(true);
      }
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
        <h1 className="mt-7 text-2xl font-bold text-slate-900">{complete ? 'Password reset complete' : 'Reset your password'}</h1>

        {complete ? (
          <div className="mt-5 space-y-5">
            <Alert tone="success">
              Your password has been changed. Sign in with your new password.
            </Alert>
            <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
              Sign in
            </Link>
          </div>
        ) : (
          <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
            <p className="text-sm leading-6 text-slate-600">
              {otpSent
                ? 'Enter the one-time code sent to your email and choose a new password.'
                : 'Enter your CampusHub email address. If it is associated with an account, we will email a one-time verification code.'}
            </p>
            {otpSent && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">If the account can be recovered, a verification code has been sent. Check your inbox and spam folder.</p>}
            {error && <Alert tone="error">{error}</Alert>}
            <div>
              <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                readOnly={otpSent}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 read-only:bg-slate-50"
                placeholder="you@campus.edu"
              />
            </div>
            {otpSent && (
              <>
                <div>
                  <label htmlFor="reset-otp" className="mb-1 block text-sm font-medium text-slate-700">Email verification code</label>
                  <input id="reset-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-slate-300 px-4 py-3 tracking-[0.3em]" placeholder="6-digit code" />
                </div>
                <div>
                  <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                  <input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                  {password && <p className="mt-1 text-xs text-slate-500">Password strength: {strength.label}</p>}
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
                  <input id="confirm-password" type="password" minLength={8} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                </div>
              </>
            )}
            <button type="submit" disabled={loading || !email.trim() || (otpSent && (otp.length !== 6 || password.length < 8))} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">
              {loading ? (otpSent ? 'Verifying code…' : 'Sending code…') : otpSent ? 'Verify and reset password' : 'Send verification code'}
            </button>
            {otpSent && (
              <button type="button" disabled={loading} onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await api.post('/auth/password/otp/request/', { email: email.trim() });
                } catch (requestError) {
                  setError(getApiErrorMessage(requestError));
                } finally {
                  setLoading(false);
                }
              }} className="w-full text-sm font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-60">
                Resend verification code
              </button>
            )}
            <p className="text-center text-sm text-slate-600">
              <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
