'use client';

import AdminCard from '@/components/AdminCard';
import PortalShell from '@/components/PortalShell';

const academicSetup = [
  { title: 'Schools', description: 'Create and maintain schools within the institution.', href: '/admin/schools' },
  { title: 'Departments', description: 'Organize departments and their academic leadership.', href: '/admin/departments' },
  { title: 'Programmes', description: 'Maintain programmes and their department relationships.', href: '/admin/courses' },
  { title: 'Units & teaching', description: 'Manage shared units and teaching assignments.', href: '/admin/units' },
];

export default function IctAdminPage() {
  return (
    <PortalShell roles={['ict_admin']}>
      <section className="space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Academic systems</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">ICT Administration</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Maintain the institution&apos;s academic structure and course configuration. Staff accounts and operational records are managed by other offices.
          </p>
        </header>

        <section aria-labelledby="academic-setup-heading">
          <h2 id="academic-setup-heading" className="mb-3 text-base font-bold tracking-tight text-slate-900">Academic structure</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {academicSetup.map((item) => <AdminCard key={item.href} {...item} />)}
          </div>
        </section>
      </section>
    </PortalShell>
  );
}
