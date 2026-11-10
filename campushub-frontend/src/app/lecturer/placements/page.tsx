'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
interface LecturerPlacementRow {
  student_id: number;
  student_name: string;
  student_email: string;
  admission_number: string | null;
  course_code: string;
  placement: { id: number; title: string; company: string; location: string; deadline: string } | null;
}
interface LecturerStudentPlacement extends LecturerPlacementRow {
  course_codes: string[];
}

export default function LecturerPlacementsPage() {
  const [rows, setRows] = useState<LecturerPlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void api.get<{ results: LecturerPlacementRow[] }>('/academics/lecturer/placements/', { signal: controller.signal })
      .then((response) => setRows(response.data.results))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const students = [...rows.reduce((byStudent, row) => {
    const existing = byStudent.get(row.student_id);
    if (existing) {
      existing.course_codes.push(row.course_code);
    } else {
      byStudent.set(row.student_id, { ...row, course_codes: [row.course_code] });
    }
    return byStudent;
  }, new Map<number, LecturerStudentPlacement>()).values()];
  const placed = students.filter((row) => row.placement).length;
  const placements = students.filter((row) => row.placement);

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-5">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Student outcomes</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Lecturer placements</h1><p className="mt-2 text-sm text-slate-600">Accepted placements reported by students enrolled in your teaching courses.</p></header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading student outcomes…</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Students in your courses" value={students.length} />
              <Stat label="Accepted placements" value={placed} />
              <Stat label="Not yet placed" value={students.length - placed} />
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {placements.length ? <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Admission no.</th><th className="px-5 py-3">Programme</th><th className="px-5 py-3">Placement</th><th className="px-5 py-3">Employer</th><th className="px-5 py-3">Deadline</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{placements.map((row) => <tr key={row.student_id}><td className="px-5 py-4"><span className="block font-medium">{row.student_name}</span><a className="text-xs text-blue-700 hover:underline" href={`mailto:${row.student_email}`}>{row.student_email}</a></td><td className="px-5 py-4">{row.admission_number ?? '—'}</td><td className="px-5 py-4">{row.course_codes.join(', ')}</td><td className="px-5 py-4 font-medium">{row.placement?.title}</td><td className="px-5 py-4">{row.placement?.company}</td><td className="px-5 py-4">{row.placement?.deadline ? new Date(row.placement.deadline).toLocaleDateString() : '—'}</td></tr>)}</tbody>
              </table> : <p className="p-8 text-center text-sm text-slate-500">{students.length ? 'No accepted student placements have been recorded yet.' : 'No students are enrolled in your courses yet.'}</p>}
            </div>
          </>
        )}
      </section>
    </PortalShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-blue-700">{value}</p></div>;
}
