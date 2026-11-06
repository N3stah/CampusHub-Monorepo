'use client';

import { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Button, EmptyState } from '@/components/ui';

const units = [
  { id: 1, code: 'CS301', title: 'Software Engineering', credits: 4, lecturer: 'Dr. K. Mwangi', prerequisite: 'Passed CS201', selected: true },
  { id: 2, code: 'CS302', title: 'Mobile Application Development', credits: 4, lecturer: 'Ms. A. Wanjiku', prerequisite: 'None', selected: false },
  { id: 3, code: 'CS303', title: 'Distributed Systems', credits: 4, lecturer: 'Dr. N. Otieno', prerequisite: 'Passed CS220', selected: false },
];

export default function SemesterRegistrationPage() {
  const [selected, setSelected] = useState<number[]>([1]);
  const [notice, setNotice] = useState<string | null>(null);
  const credits = units.filter((unit) => selected.includes(unit.id)).reduce((sum, unit) => sum + unit.credits, 0);

  return (
    <PortalShell roles={['student', 'registrar', 'admin']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">2026/2027 · Semester 1</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Semester registration</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Select units, review prerequisites, and submit your registration before the add/drop deadline.</p>
        </header>
        {units.length === 0 ? <EmptyState title="Registration is not open" description="No offered units are available for this academic period." /> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm">
              <p><strong>{credits}</strong> of 24 credits selected</p>
              <p className="text-blue-800">Add/drop closes 18 September 2026</p>
            </div>
            <div className="grid gap-3">
              {units.map((unit) => {
                const checked = selected.includes(unit.id);
                return (
                  <label key={unit.id} className={`flex cursor-pointer gap-4 rounded-2xl border bg-white p-5 transition ${checked ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                    <input type="checkbox" checked={checked} disabled={credits + unit.credits > 24 && !checked} onChange={() => setSelected((current) => checked ? current.filter((id) => id !== unit.id) : [...current, unit.id])} className="mt-1 h-4 w-4 accent-blue-700" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2"><strong>{unit.code}</strong><span className="font-semibold">{unit.title}</span></span>
                      <span className="mt-1 block text-sm text-slate-600">{unit.lecturer} · {unit.credits} credits</span>
                      <span className="mt-2 block text-xs font-medium text-slate-500">Prerequisite: {unit.prerequisite}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {notice && <Alert tone="success">{notice}</Alert>}
            <Button onClick={() => setNotice('Registration saved. Connect the academic registration API to submit it to the institution.')} disabled={!selected.length}>Submit registration</Button>
          </>
        )}
      </section>
    </PortalShell>
  );
}
