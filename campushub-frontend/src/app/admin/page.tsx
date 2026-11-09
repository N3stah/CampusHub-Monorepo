'use client';

import AdminCard from '@/components/AdminCard';
import PortalShell from '@/components/PortalShell';

const staffManagement = [
  {
    title: 'User accounts',
    description: 'Create and manage staff accounts and assign institutional roles.',
    href: '/users',
  },
  {
    title: 'Lecturers',
    description: 'Create lecturer accounts and manage their department and profile details.',
    href: '/lecturers',
  },
  {
    title: 'AI insights & analytics',
    description: 'Review AI task usage, provider activity, and model readiness.',
    href: '/ai',
  },
  {
    title: 'Access audit',
    description: 'Review account activity and system events.',
    href: '/admin/logs',
  },
];

export default function AdminPage() {
  return (
    <PortalShell roles={['admin']}>
      <section className="space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Identity and access</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Super Admin</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage staff accounts and access roles. Academic setup, admissions, finance, library, and hostel operations belong to their respective teams.
          </p>
        </header>

        <section aria-labelledby="accounts-heading">
          <h2 id="accounts-heading" className="mb-3 text-base font-bold tracking-tight text-slate-900">Accounts and access</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {staffManagement.map((item) => <AdminCard key={item.href} {...item} />)}
          </div>
        </section>
      </section>
    </PortalShell>
  );
}
