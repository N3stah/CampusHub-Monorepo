'use client';

import Link from 'next/link';
import PortalShell from '@/components/PortalShell';

const managementLinks = [
  { title: 'Schools', detail: 'Create and maintain the top level of the academic structure.', href: '/admin/schools' },
  { title: 'Departments', detail: 'Place departments within schools and manage their heads and members.', href: '/admin/departments' },
  { title: 'Academic programmes', detail: 'Create degree programmes and assign each to its owning department.', href: '/admin/courses' },
  { title: 'Units and teaching', detail: 'Share units across departments and programmes; assign one or more lecturers per offering.', href: '/admin/units' },
  { title: 'Programme admissions', detail: 'Assign students to programmes by admission number and manage enrolment status.', href: '/admin/enrollments' },
  { title: 'Student directory', detail: 'Find and manage student accounts by admission number.', href: '/users?role=student' },
  { title: 'Lecturer directory', detail: 'Manage lecturer accounts and primary departments.', href: '/lecturers' },
  { title: 'Placement officer accounts', detail: 'Manage placement officer accounts.', href: '/users?role=officer' },
  { title: 'Placements', detail: 'Create opportunities and manage listings for students.', href: '/placements' },
  { title: 'Applications', detail: 'Review applicants and record placement decisions.', href: '/applications' },
  { title: 'System logs', detail: 'Review administrative activity and captured server errors.', href: '/admin/logs' },
];

export default function AdminPage() {
  return (
    <PortalShell roles={['admin']}>
      <section className="space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Campus operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Overview</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">A quick view of campus activity and the tools to manage it.</p>
        </header>

        <section aria-labelledby="academic-setup-heading" className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
          <h2 id="academic-setup-heading" className="text-sm font-semibold text-slate-900">Academic setup</h2>
          <ol className="mt-2 grid gap-x-4 gap-y-1.5 text-xs leading-5 text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
            <li><span className="font-semibold text-blue-700">1.</span> Add schools</li>
            <li><span className="font-semibold text-blue-700">2.</span> Place departments in schools</li>
            <li><span className="font-semibold text-blue-700">3.</span> Create programmes in departments</li>
            <li><span className="font-semibold text-blue-700">4.</span> Add shared units and assign lecturers</li>
          </ol>
        </section>

        <section aria-labelledby="management-heading">
          <div className="mb-3">
            <h2 id="management-heading" className="text-lg font-bold tracking-tight text-slate-900">Administration</h2>
            <p className="mt-0.5 text-sm text-slate-500">Manage academic structure, campus accounts, and placements.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {managementLinks.map((item) => (
              <Link key={item.href} href={item.href} className="group flex min-h-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:px-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-slate-500">{item.detail}</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-sm font-semibold text-blue-700 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            ))}
          </div>
        </section>

      </section>
    </PortalShell>
  );
}
