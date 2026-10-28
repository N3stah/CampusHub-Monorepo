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
      <section className="space-y-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CampusHub</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Administration</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Set up the academic structure in order, manage campus accounts, and operate student placements.</p>
        </div>

        <section aria-labelledby="academic-setup-heading" className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 id="academic-setup-heading" className="font-semibold text-slate-900">Academic setup workflow</h2>
          <ol className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
            <li><span className="font-semibold text-blue-700">1.</span> Add schools</li>
            <li><span className="font-semibold text-blue-700">2.</span> Place departments in schools</li>
            <li><span className="font-semibold text-blue-700">3.</span> Create programmes in departments</li>
            <li><span className="font-semibold text-blue-700">4.</span> Add shared units and assign lecturers</li>
          </ol>
        </section>

        <section aria-labelledby="management-heading">
          <div className="mb-3">
            <h2 id="management-heading" className="font-semibold">Directories and management</h2>
            <p className="mt-1 text-sm text-slate-500">Choose an admin task. Each area owns a distinct part of campus operations.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {managementLinks.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-5 text-slate-500">{item.detail}</p>
                <p className="mt-4 text-sm font-semibold text-blue-700">Open section →</p>
              </Link>
            ))}
          </div>
        </section>

      </section>
    </PortalShell>
  );
}
