'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import DownloadApplicationCvButton from '@/components/DownloadApplicationCvButton';
import type { ApiPage, StudentApplication } from '@/types/portal';

const statuses = ['pending', 'shortlisted', 'accepted', 'rejected'] as const;

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  shortlisted: 'bg-blue-50 text-blue-800',
  accepted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
};

export default function ApplicationReviewPanel() {
  const [page, setPage] = useState<ApiPage<StudentApplication> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  const loadApplications = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getApiPage<StudentApplication>('/applications/', { page: pageNumber }, signal);
      setPage(result);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [pageNumber]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadApplications(controller.signal));
    return () => controller.abort();
  }, [loadApplications]);

  async function updateStatus(application: StudentApplication, status: string) {
    setUpdatingId(application.id);
    setError(null);
    try {
      await api.patch(`/applications/${application.id}/status/`, { status });
      setPage((current) => current && ({
        ...current,
        results: current.results.map((item) => item.id === application.id ? { ...item, status } : item),
      }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section aria-labelledby="review-applications-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="review-applications-heading" className="font-semibold">Review applications</h2>
          <p className="mt-1 text-xs text-slate-500">Update shortlisted, accepted, or rejected decisions</p>
        </div>
        {page && <span className="text-sm text-slate-500">{page.count} total</span>}
      </div>
      {error && (
        <div className="flex flex-col justify-between gap-2 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800 sm:flex-row sm:items-center">
          <p role="alert">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); void loadApplications(); }} className="self-start font-semibold underline sm:self-auto">Try again</button>
        </div>
      )}
      {loading ? (
        <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading applications…</p>
      ) : page?.results.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Student</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Placement</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Applied</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">CV</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Update status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.results.map((application) => (
                  <tr key={application.id}>
                    <td className="px-5 py-4">
                      {application.cv_file
                        ? <DownloadApplicationCvButton applicationId={application.id} cvUrl={application.cv_file} />
                        : <span className="text-xs text-slate-500">Not provided</span>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {application.student
                          ? `${application.student.first_name} ${application.student.last_name}`
                          : `Application #${application.id}`}
                      </p>
                      {application.student?.email && <p className="mt-1 text-xs text-slate-500">{application.student.email}</p>}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {application.placement?.title ?? application.placement_title ?? 'Placement'}
                      {(application.placement?.company ?? application.company) && (
                        <p className="mt-1 text-xs text-slate-500">{application.placement?.company ?? application.company}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {application.applied_at ? new Date(application.applied_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[application.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {application.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <label className="sr-only" htmlFor={`application-status-${application.id}`}>Update status for application {application.id}</label>
                      <select
                        id={`application-status-${application.id}`}
                        value={application.status}
                        disabled={updatingId === application.id}
                        onChange={(event) => void updateStatus(application, event.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                      >
                        {!statuses.includes(application.status as typeof statuses[number]) && <option value={application.status}>{application.status}</option>}
                        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              disabled={!page.previous || loading}
              onClick={() => { setLoading(true); setPageNumber((current) => Math.max(1, current - 1)); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {pageNumber}</span>
            <button
              type="button"
              disabled={!page.next || loading}
              onClick={() => { setLoading(true); setPageNumber((current) => current + 1); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-500">{error ? 'Applications could not be loaded.' : 'No applications have been submitted yet.'}</p>
      )}
    </section>
  );
}
