'use client';

import { useMemo, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

const students = [
  { id: 1, name: 'Morgan Atieno', admission: '23/08181', cat: 24, exam: 54 },
  { id: 2, name: 'Jamie Njeri', admission: '23/08182', cat: 20, exam: 48 },
  { id: 3, name: 'Alex Ouma', admission: '23/08183', cat: 27, exam: 61 },
];

export default function ExaminationsPage() {
  const { user } = useAuth();
  const canManage = user?.role !== 'student';
  const [catWeight, setCatWeight] = useState(40);
  const [examWeight, setExamWeight] = useState(60);
  const [notice, setNotice] = useState<string | null>(null);
  const validWeights = catWeight + examWeight === 100;
  const results = useMemo(() => students.map((student) => {
    const score = (student.cat / 30 * catWeight) + (student.exam / 70 * examWeight);
    const grade = score >= 70 ? 'A' : score >= 60 ? 'B' : score >= 50 ? 'C' : score >= 40 ? 'D' : 'E';
    return { ...student, score: score.toFixed(1), grade };
  }), [catWeight, examWeight]);

  return (
    <PortalShell roles={['student', 'lecturer', 'examination', 'registrar']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{canManage ? 'Examinations office' : 'Academic results'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Assessments and grades</h1>
        </header>
        {canManage && (
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3 sm:items-end">
            <div><label htmlFor="cat-weight" className="mb-1 block text-sm font-medium">CAT weight (%)</label><input id="cat-weight" type="number" min="0" max="100" value={catWeight} onChange={(event) => setCatWeight(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></div>
            <div><label htmlFor="exam-weight" className="mb-1 block text-sm font-medium">Exam weight (%)</label><input id="exam-weight" type="number" min="0" max="100" value={examWeight} onChange={(event) => setExamWeight(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></div>
            <Button disabled={!validWeights} onClick={() => setNotice(validWeights ? 'Grade calculation preview updated locally.' : 'CAT and exam weights must total 100%.')}>Update grade book</Button>
          </div>
        )}
        {!validWeights && <Alert tone="error">Assessment weights must total 100%.</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">CS301 · Software Engineering</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Admission</th><th className="px-5 py-3">CAT / 30</th><th className="px-5 py-3">Exam / 70</th><th className="px-5 py-3">Final</th><th className="px-5 py-3">Grade</th></tr></thead><tbody className="divide-y divide-slate-100">{results.map((row) => <tr key={row.id}><td className="px-5 py-3 font-medium">{row.name}</td><td className="px-5 py-3 text-slate-600">{row.admission}</td><td className="px-5 py-3">{row.cat}</td><td className="px-5 py-3">{row.exam}</td><td className="px-5 py-3 font-semibold">{row.score}%</td><td className="px-5 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 font-bold text-blue-700">{row.grade}</span></td></tr>)}</tbody></table></div>
        </section>
      </section>
    </PortalShell>
  );
}
