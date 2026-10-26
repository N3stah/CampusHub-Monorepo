'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ApplicationReviewPanel from '@/components/ApplicationReviewPanel';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { StudentApplication } from '@/types/portal';

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  shortlisted: 'bg-blue-50 text-blue-800',
  accepted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
  withdrawn: 'bg-slate-100 text-slate-600',
};

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    if (user?.role !== 'student') {
      setLoading(false);
      return;
    }
    try {
      const page = await getApiPage<StudentApplication>('/applications/', {}, signal);
      setApplications(page.results);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadApplications(controller.signal));
    return () => controller.abort();
  }, [loadApplications]);

  async function withdraw(application: StudentApplication) {
    if (!window.confirm(`Withdraw your application for ${application.placement?.title ?? 'this placement'}?`)) return;
    setBusyId(application.id);
    setError(null);
    try {
      await api.delete(`/applications/${application.id}/withdraw/`);
      setApplications((current) => current.map((item) => (
        item.id === application.id ? { ...item, status: 'withdrawn' } : item
      )));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  }

  const staffView = user?.role === 'officer' || user?.role === 'admin';

  return (
    <PortalShell roles={['student', 'officer', 'admin']}>
      {staffView ? (
        <div className="space-y-5">
          <header>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Placement office</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Applications</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Review applications submitted to your placement listings and record decisions.</p>
          </header>
          <ApplicationReviewPanel />
        </div>
      ) : (
        <section className="space-y-5">
          <header>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Student portal</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">My applications</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Follow placement decisions, review your submissions, or withdraw a pending application.</p>
          </header>
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{error}</p>
              <button type="button" onClick={() => { setLoading(true); void loadApplications(); }} className="mt-2 font-semibold underline">Try again</button>
            </div>
          )}
          {loading ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Loading your applications…</p>
          ) : applications.length ? (
            <ul className="space-y-3">
              {applications.map((application) => (
                <li key={application.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                  <div>
                    <Link href={`/applications/${application.id}`} className="font-semibold text-blue-700 hover:underline">
                      {application.placement?.title ?? 'Placement application'}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">{application.placement?.company ?? 'Employer unavailable'}</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted {new Date(application.applied_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle[application.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {application.status}
                    </span>
                    {application.status === 'pending' && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void withdraw(application)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyId === application.id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-semibold text-slate-900">No applications yet</p>
              <p className="mt-1 text-sm text-slate-500">Browse open opportunities and submit your first application.</p>
              <Link href="/placements" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Browse placements</Link>
            </div>
          )}
        </section>
      )}
    </PortalShell>
  );
}
