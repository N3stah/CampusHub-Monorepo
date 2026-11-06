'use client';

import { useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Button } from '@/components/ui';

const initialPeriods = [
  { id: 1, academicYear: '2026/2027', name: 'Semester 1', opens: '2026-08-24', closes: '2026-12-18', active: true },
  { id: 2, academicYear: '2026/2027', name: 'Semester 2', opens: '2027-01-18', closes: '2027-05-21', active: false },
];

export default function AcademicPeriodsPage() {
  const [periods, setPeriods] = useState(initialPeriods);
  const [notice, setNotice] = useState<string | null>(null);

  function activatePeriod(id: number) {
    setPeriods((current) => current.map((period) => ({ ...period, active: period.id === id })));
    setNotice('Academic period status updated locally.');
  }

  function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('Academic period saved locally. Connect the academic-period API before production use.');
  }

  return (
    <PortalShell roles={['registrar', 'admin']}>
      <section className="space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Academic administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Academic years and semesters</h1></header>
        <form onSubmit={createPeriod} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4 sm:items-end">
          <div><label htmlFor="academic-year" className="mb-1 block text-sm font-medium">Academic year</label><input id="academic-year" required placeholder="2027/2028" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></div>
          <div><label htmlFor="period-name" className="mb-1 block text-sm font-medium">Term / semester</label><input id="period-name" required placeholder="Semester 1" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></div>
          <div><label htmlFor="period-start" className="mb-1 block text-sm font-medium">Starts</label><input id="period-start" required type="date" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></div>
          <Button type="submit">Create period</Button>
        </form>
        {notice && <Alert tone="info">{notice}</Alert>}
        <div className="grid gap-3">{periods.map((period) => <article key={period.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div><p className="font-semibold">{period.academicYear} · {period.name}</p><p className="mt-1 text-sm text-slate-500">{period.opens} to {period.closes}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${period.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{period.active ? 'Active' : 'Inactive'}</span>{!period.active && <Button tone="secondary" onClick={() => activatePeriod(period.id)}>Activate</Button>}</div></article>)}</div>
      </section>
    </PortalShell>
  );
}
