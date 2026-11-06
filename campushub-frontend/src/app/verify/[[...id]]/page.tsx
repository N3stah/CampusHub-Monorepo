'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui';

export default function CredentialVerificationPage() {
  const [credentialId, setCredentialId] = useState('');
  const [result, setResult] = useState<'valid' | 'invalid' | null>(null);

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(credentialId.trim().length >= 8 ? 'valid' : 'invalid');
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CampusHub public verification</p>
        <h1 className="mt-2 text-3xl font-bold">Verify a credential</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Enter the UUID printed beneath the QR code on a CampusHub result slip, transcript, or admission letter.</p>
        <form onSubmit={verify} className="mt-6 flex gap-3">
          <label htmlFor="credential-id" className="sr-only">Credential identifier</label>
          <input id="credential-id" required value={credentialId} onChange={(event) => setCredentialId(event.target.value)} placeholder="Credential UUID" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3" />
          <button type="submit" className="rounded-xl bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800">Verify</button>
        </form>
        {result && <div className="mt-5"><Alert tone={result === 'valid' ? 'success' : 'error'}>{result === 'valid' ? 'Credential format verified. Connect the public verification API to confirm the record.' : 'This identifier is not valid. Check the code and try again.'}</Alert></div>}
      </section>
    </main>
  );
}
