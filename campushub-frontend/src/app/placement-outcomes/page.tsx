'use client';

import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';

interface Department { id: number; name: string; code: string }
interface Outcome {
  department_id: number | null;
  department_name: string;
  department_code: string;
  total_applications: number;
  accepted: number;
  pending: number;
  shortlisted: number;
  rejected: number;
  withdrawn: number;
  unique_applicants: number;
  acceptance_rate: number;
}

export default function PlacementOutcomesPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOutcomes = useCallback(async (selectedDepartment: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await api.get<{ results: Outcome[] }>('/admin/placement-outcomes/', {
        params: selectedDepartment ? { department_id: selectedDepartment } : undefined,
        signal,
      });
      if (!signal?.aborted) {
        setOutcomes(response.data.results);
        setError(null);
      }
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getApiPage<Department>('/academics/departments/', {}, controller.signal)
      .then((page) => setDepartments(page.results))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadOutcomes(departmentId, controller.signal));
    return () => controller.abort();
  }, [departmentId, loadOutcomes]);

  const totalApplications = outcomes.reduce((total, outcome) => total + outcome.total_applications, 0);
  const totalAccepted = outcomes.reduce((total, outcome) => total + outcome.accepted, 0);
  const overallAcceptance = totalApplications ? Math.round((totalAccepted / totalApplications) * 100) : 0;

  return (
    <PortalShell roles={['admin', 'officer']}>
      <section className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Career services</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Placement outcomes</h1><p className="mt-2 text-sm text-slate-600">Application outcomes and placement acceptance by department.</p></div>
          <label className="text-sm font-medium text-slate-700">Department
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="mt-1 block min-w-56 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</select>
          </label>
        </header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Applications" value={totalApplications} />
          <Stat label="Accepted" value={totalAccepted} />
          <Stat label="Overall acceptance" value={`${overallAcceptance}%`} />
        </div>
        {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading placement outcomes…</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            {outcomes.length ? <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Department</th><th className="px-4 py-3">Applicants</th><th className="px-4 py-3">Applications</th><th className="px-4 py-3">Accepted</th><th className="px-4 py-3">Shortlisted</th><th className="px-4 py-3">Pending</th><th className="px-4 py-3">Rejected</th><th className="px-4 py-3">Acceptance</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{outcomes.map((outcome) => <tr key={outcome.department_id ?? 'unassigned'}><td className="px-4 py-4 font-medium">{outcome.department_code} · {outcome.department_name}</td><td className="px-4 py-4">{outcome.unique_applicants}</td><td className="px-4 py-4">{outcome.total_applications}</td><td className="px-4 py-4 text-emerald-700">{outcome.accepted}</td><td className="px-4 py-4">{outcome.shortlisted}</td><td className="px-4 py-4">{outcome.pending}</td><td className="px-4 py-4 text-red-700">{outcome.rejected}</td><td className="px-4 py-4">{Math.round(outcome.acceptance_rate * 100)}%</td></tr>)}</tbody>
            </table> : <p className="p-8 text-center text-sm text-slate-500">No placement applications match this department.</p>}
          </div>
        )}
      </section>
    </PortalShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-blue-700">{value}</p></div>;
}
