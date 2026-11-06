'use client';

import { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';

const applicants = [
  { id: 1, name: 'Grace Mutua', programme: 'Diploma in ICT', status: 'Pending documents', email: 'grace@example.test' },
  { id: 2, name: 'Brian Kiptoo', programme: 'Bachelor of Computing', status: 'Ready for review', email: 'brian@example.test' },
  { id: 3, name: 'Faith Achieng', programme: 'Diploma in Business', status: 'Admitted', email: 'faith@example.test' },
];

export default function AdmissionsPage() {
  const [filter, setFilter] = useState('All');
  const visible = filter === 'All' ? applicants : applicants.filter((applicant) => applicant.status === filter);

  return (
    <PortalShell roles={['student', 'registrar', 'admin']}>
      <section className="space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Registrar office</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Admissions</h1><p className="mt-2 text-sm text-slate-600">Review applications, programme choices, supporting documents, and admission decisions.</p></header>
        <Alert tone="info">Applicant self-service submission will appear here when the admissions API is connected.</Alert>
        <div className="flex flex-wrap gap-2">{['All', 'Pending documents', 'Ready for review', 'Admitted'].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === value ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{value}</button>)}</div>
        <div className="grid gap-3">{visible.map((applicant) => <article key={applicant.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div><p className="font-semibold text-slate-900">{applicant.name}</p><p className="mt-1 text-sm text-slate-600">{applicant.programme} · {applicant.email}</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{applicant.status}</span></article>)}</div>
      </section>
    </PortalShell>
  );
}
