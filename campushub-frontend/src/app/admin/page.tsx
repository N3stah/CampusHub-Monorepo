'use client';

import AdminCard from '@/components/AdminCard';
import PortalShell from '@/components/PortalShell';

/* ── SVG micro-icons (20×20, Heroicons-style) ─────────────────────── */
const icons = {
  school: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10 1L1 6l9 5 9-5-9-5z" />
      <path d="M1 10l9 5 9-5M1 14l9 5 9-5" strokeWidth="1.5" stroke="currentColor" fill="none" />
    </svg>
  ),
  department: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm5 0v2h2V4H9zm0 4v2h2V8H9zm0 4v2h2v-2H9zM6 4v2h1V4H6zm0 4v2h1V8H6zm0 4v2h1v-2H6zm7-8v2h1V4h-1zm0 4v2h1V8h-1zm0 4v2h1v-2h-1z" clipRule="evenodd" />
    </svg>
  ),
  programme: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3.001zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
    </svg>
  ),
  unit: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
    </svg>
  ),
  enrolment: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  ),
  student: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
  lecturer: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3.001z" />
      <path d="M9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
    </svg>
  ),
  officer: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
    </svg>
  ),
  placement: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
      <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
    </svg>
  ),
  application: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  ),
  log: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm0 5a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm1 4a1 1 0 00-1 1v2a1 1 0 001 1h12a1 1 0 001-1v-2a1 1 0 00-1-1H4z" clipRule="evenodd" />
    </svg>
  ),
};

/* ── Grouped admin links ──────────────────────────────────────────── */
const academicStructure = [
  { title: 'Schools', description: 'Create and maintain the top level of the academic structure.', href: '/admin/schools', icon: icons.school },
  { title: 'Departments', description: 'Place departments within schools and manage their heads.', href: '/admin/departments', icon: icons.department },
  { title: 'Programmes', description: 'Create degree programmes and assign to departments.', href: '/admin/courses', icon: icons.programme },
  { title: 'Units & teaching', description: 'Shared units across programmes; assign lecturers per offering.', href: '/admin/units', icon: icons.unit },
];

const peopleAccounts = [
  { title: 'Students', description: 'Find and manage student accounts by admission number.', href: '/users?role=student', icon: icons.student },
  { title: 'Lecturers', description: 'Manage lecturer accounts and home departments.', href: '/lecturers', icon: icons.lecturer },
  { title: 'Placement officers', description: 'Manage placement officer accounts.', href: '/users?role=officer', icon: icons.officer },
  { title: 'Enrolments', description: 'Assign students to programmes and manage enrolment status.', href: '/admin/enrollments', icon: icons.enrolment },
];

const placementsAndLogs = [
  { title: 'Placements', description: 'Create opportunities and manage listings.', href: '/placements', icon: icons.placement },
  { title: 'Applications', description: 'Review applicants and record placement decisions.', href: '/applications', icon: icons.application },
  { title: 'System logs', description: 'Review admin activity and server errors.', href: '/admin/logs', icon: icons.log },
];

function SectionHeading({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <PortalShell roles={['admin']}>
      <section className="space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Campus operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Administration</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Manage the academic structure, campus accounts, placements, and system settings.
          </p>
        </header>

        {/* Quick-start guide */}
        <section aria-labelledby="setup-heading" className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 px-5 py-4">
          <h2 id="setup-heading" className="text-sm font-semibold text-slate-800">🚀 Getting started</h2>
          <p className="mt-1 text-xs text-slate-600">Follow this order when setting up a new institution:</p>
          <ol className="mt-2.5 grid gap-x-6 gap-y-1.5 text-xs leading-5 text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
            <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">1</span> Add schools</li>
            <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">2</span> Create departments</li>
            <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">3</span> Add programmes</li>
            <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">4</span> Create units & assign lecturers</li>
          </ol>
        </section>

        {/* Academic structure */}
        <section aria-labelledby="academic-heading">
          <SectionHeading id="academic-heading" title="Academic structure" subtitle="Schools, departments, programmes, and shared units." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {academicStructure.map((item) => (
              <AdminCard key={item.href} {...item} />
            ))}
          </div>
        </section>

        {/* People & accounts */}
        <section aria-labelledby="people-heading">
          <SectionHeading id="people-heading" title="People & accounts" subtitle="Manage students, lecturers, placement officers, and enrolments." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {peopleAccounts.map((item) => (
              <AdminCard key={item.href} {...item} />
            ))}
          </div>
        </section>

        {/* Placements & system */}
        <section aria-labelledby="placements-heading">
          <SectionHeading id="placements-heading" title="Placements & system" subtitle="Opportunities, applications, and admin logs." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {placementsAndLogs.map((item) => (
              <AdminCard key={item.href} {...item} />
            ))}
          </div>
        </section>
      </section>
    </PortalShell>
  );
}
