'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import { createApplicationFormData, validateCvFile } from '@/lib/application-files';
import type { Placement, StudentApplication } from '@/types/portal';

export default function PlacementApplicationPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50"><p role="status" className="text-sm text-slate-500">Loading application form…</p></main>}>
      <PlacementApplicationContent />
    </Suspense>
  );
}

function PlacementApplicationContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlacement = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<Placement>(`/placements/${id}/`, { signal });
      setPlacement(response.data);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadPlacement(controller.signal));
    return () => controller.abort();
  }, [loadPlacement]);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = createApplicationFormData(coverNote, cvFile);
      const response = await api.post<StudentApplication>(`/placements/${id}/apply/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      router.push(`/applications/${response.data.id}`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell roles={['student']}>
      <section className="mx-auto max-w-2xl space-y-5">
        <Link href={`/placements/${id}`} className="text-sm font-semibold text-blue-700 hover:underline">← Back to opportunity</Link>
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Placement application</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{placement?.title ?? 'Apply for a placement'}</h1>
          {placement && <p className="mt-2 text-sm text-slate-600">{placement.company} · Deadline {new Date(`${placement.deadline}T00:00:00`).toLocaleDateString()}</p>}
        </header>
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading opportunity…</p>
        ) : error && !placement ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>
        ) : placement && !placement.is_active ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This opportunity is no longer accepting applications.</p>
        ) : placement ? (
          <form onSubmit={(event) => void submitApplication(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <label className="block text-sm font-medium text-slate-700">
              Cover note
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={7}
                value={coverNote}
                onChange={(event) => setCoverNote(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="Explain your interest and relevant experience."
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              CV <span className="font-normal text-slate-500">(optional; PDF, DOC, or DOCX)</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  const validationError = file ? validateCvFile(file) : null;
                  if (validationError) {
                    setError(validationError);
                    event.target.value = '';
                    setCvFile(null);
                    return;
                  }
                  setError(null);
                  setCvFile(file);
                }}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">Your application and any attached CV will only be available to you, the officer responsible for this listing, and portal administrators.</p>
            <button type="submit" disabled={submitting || !coverNote.trim()} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        ) : null}
      </section>
    </PortalShell>
  );
}
