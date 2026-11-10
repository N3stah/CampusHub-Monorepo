'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';

interface AtRiskStudent {
  student_id: number;
  student_name: string;
  student_email: string;
  admission_number: string | null;
  attendance_rate: number;
  attended_sessions: number;
  total_sessions: number;
  missed_assignments: number;
  total_assignments: number;
  at_risk: boolean;
  reasons: string[];
}

export default function AtRiskStudentsPanel({ offeringId }: { offeringId: string }) {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<{ results: AtRiskStudent[] }>(`/academics/offerings/${offeringId}/at-risk/`, { signal });
      if (!signal?.aborted) {
        setStudents(response.data.results);
        setError(null);
      }
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadStudents(controller.signal));
    return () => controller.abort();
  }, [loadStudents]);

  const atRisk = students.filter((student) => student.at_risk);

  return (
    <section aria-labelledby="at-risk-heading" className="border-b border-slate-100 bg-slate-50/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 id="at-risk-heading" className="font-semibold">Students needing support</h3><p className="mt-1 text-xs text-slate-500">Based on attendance below 75% or at least two missed assignment submissions.</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${atRisk.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{loading ? 'Checking…' : `${atRisk.length} at risk`}</span>
      </div>
      {error && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => { setLoading(true); void loadStudents(); }} className="font-semibold underline">Try again</button></div>}
      {!loading && !error && (atRisk.length ? (
        <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {atRisk.map((student) => <li key={student.student_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div><p className="text-sm font-semibold">{student.student_name}</p><p className="mt-0.5 text-xs text-slate-500">{student.admission_number ?? student.student_email} · {Math.round(student.attendance_rate * 100)}% attendance · {student.missed_assignments}/{student.total_assignments} missed</p></div>
            <div className="flex flex-wrap gap-1">{student.reasons.map((reason) => <span key={reason} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium capitalize text-amber-800">{reason}</span>)}</div>
          </li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-slate-500">No students currently meet the at-risk criteria.</p>)}
    </section>
  );
}
