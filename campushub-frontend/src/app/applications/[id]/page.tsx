'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import PortalShell from '@/components/PortalShell';
import DownloadApplicationCvButton from '@/components/DownloadApplicationCvButton';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import type { StudentApplication } from '@/types/portal';

export default function ApplicationDetailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50"><p role="status" className="text-sm text-slate-500">Loading application…</p></main>}>
      <ApplicationDetailContent />
    </Suspense>
  );
}

function ApplicationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [application, setApplication] = useState<StudentApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApplication = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<StudentApplication>(`/applications/${id}/`, { signal });
      setApplication(response.data);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadApplication(controller.signal));
    return () => controller.abort();
  }, [loadApplication]);

  return (
    <PortalShell roles={['student', 'officer', 'admin']}>
      <section className="mx-auto max-w-3xl space-y-5">
        <Link href="/applications" className="text-sm font-semibold text-blue-700 hover:underline">← Back to applications</Link>
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading application…</p>
        ) : error || !application ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? 'Application not found.'}</p>
        ) : (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Application #{application.id}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{application.placement?.title ?? 'Placement application'}</h1>
              <p className="mt-2 text-sm text-slate-600">{application.placement?.company}</p>
              <p className="mt-4 text-sm text-slate-500">Submitted {new Date(application.applied_at).toLocaleString()}</p>
              <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-800">{application.status}</span>
            </header>
            {user?.role !== 'student' && application.student && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold">Applicant</h2>
                <p className="mt-2 text-sm text-slate-700">{application.student.first_name} {application.student.last_name}</p>
                {application.student.email && <p className="mt-1 text-sm text-slate-500">{application.student.email}</p>}
              </section>
            )}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Cover note</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{application.cover_note || 'No cover note was provided.'}</p>
              {application.cv_file && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <DownloadApplicationCvButton applicationId={application.id} cvUrl={application.cv_file} />
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </PortalShell>
  );
}
