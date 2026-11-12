'use client';

import AdminCard from '@/components/AdminCard';
import PortalShell from '@/components/PortalShell';
import ServiceOverview, { type ServiceMetric } from '@/components/ServiceOverview';

const registrarMetrics: ServiceMetric[] = [
  { label: 'Applications awaiting review', endpoint: '/admissions/applications/', params: { status: 'under_review' }, href: '/admissions' },
  { label: 'Active student accounts', endpoint: '/users/', params: { role: 'student' }, href: '/registrar/students' },
  { label: 'Programme enrolments', endpoint: '/academics/admin/enrollments/', params: { status: 'active' }, href: '/admin/enrollments' },
  { label: 'Unit registrations', endpoint: '/academics/registrations/', params: { status: 'registered' }, href: '/academics/registration' },
];

const registrarWorkflows = [
  { title: 'Admissions', description: 'Review applicants and record admission decisions.', href: '/admissions' },
  { title: 'Student accounts', description: 'Search the active student directory or register an admitted student.', href: '/registrar/students' },
  { title: 'Programme enrolments', description: 'Assign admitted students to programmes and manage enrolment status.', href: '/admin/enrollments' },
  { title: 'Semester registration', description: 'Review and support student registration for academic periods.', href: '/academics/registration' },
  { title: 'Academic periods', description: 'Review academic-year and semester schedules.', href: '/academics/periods' },
  { title: 'Examinations & grades', description: 'Coordinate examination administration and academic records.', href: '/examinations' },
  { title: 'Credential verification', description: 'Review and verify student academic credentials.', href: '/verify' },
];

export default function RegistrarPage() {
  return (
    <PortalShell roles={['registrar']}>
      <section className="space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Academic services</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Registrar Office</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Coordinate admissions, student records, programme enrolments, and academic registration.
          </p>
        </header>
        <ServiceOverview title="Registrar workload" metrics={registrarMetrics} />
        <section aria-labelledby="registrar-workflows-heading">
          <h2 id="registrar-workflows-heading" className="mb-3 text-base font-bold tracking-tight text-slate-900">Registrar workflows</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {registrarWorkflows.map((item) => <AdminCard key={item.href} {...item} />)}
          </div>
        </section>
      </section>
    </PortalShell>
  );
}
