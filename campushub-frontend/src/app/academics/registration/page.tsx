'use client';

import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';

export default function SemesterRegistrationPage() {
  const { user } = useAuth();

  if (user?.role === 'registrar') {
    return (
      <PortalShell roles={['registrar']}>
        <section className="space-y-6">
          <header>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Academic administration</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Semester registrations</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Review and manage student registrations by academic period and unit.</p>
          </header>
          <ApiCrudWorkspace
            title="Registrations"
            description="Review unit registrations and update their status. Preserve historical registrations rather than deleting them."
            endpoint="/academics/registrations/"
            fields={[
              { name: 'student_id', label: 'Student', type: 'number', required: true, lookup: { endpoint: '/users/', params: { role: 'student' }, labelFields: ['admission_number', 'first_name', 'last_name', 'email'] } },
              { name: 'academic_period_id', label: 'Academic period', type: 'number', required: true, lookup: { endpoint: '/academics/periods/', labelFields: ['academic_year', 'name'] } },
              { name: 'unit_id', label: 'Unit', type: 'number', required: true, lookup: { endpoint: '/academics/units/', labelFields: ['code', 'title'] } },
              { name: 'status', label: 'Status', options: [{ value: 'registered', label: 'Registered' }, { value: 'dropped', label: 'Dropped' }, { value: 'completed', label: 'Completed' }], required: true },
              { name: 'registered_on', label: 'Registration date', type: 'date', required: true },
            ]}
            displayFields={['student_name', 'academic_period_name', 'unit_code', 'status', 'registered_on']}
            displayLabels={{ student_name: 'Student', academic_period_name: 'Academic period', unit_code: 'Unit', registered_on: 'Registered on' }}
            allowDelete={false}
          />
        </section>
      </PortalShell>
    );
  }

  return (
    <PortalShell roles={['student']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Student academic services</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Semester registration</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Register for an offered unit in the active academic period and review your current registrations.</p>
        </header>
        <ApiCrudWorkspace
          title="My unit registrations"
          description="Choose an active academic period and unit. Historical registrations should be cancelled or completed, not erased."
          endpoint="/academics/registrations/"
          fields={[
            { name: 'student_id', label: 'Student account', required: true, defaultValue: String(user?.id ?? ''), readOnly: true, hidden: true },
            { name: 'academic_period_id', label: 'Academic period', type: 'number', required: true, lookup: { endpoint: '/academics/periods/', params: { status: 'active' }, labelFields: ['academic_year', 'name'] } },
            { name: 'unit_id', label: 'Unit', type: 'number', required: true, lookup: { endpoint: '/academics/units/', params: { is_active: 'true' }, labelFields: ['code', 'title'] } },
            { name: 'status', label: 'Status', required: true, defaultValue: 'registered', hidden: true },
            { name: 'registered_on', label: 'Registration date', type: 'date', required: true, defaultValue: () => new Date().toISOString().slice(0, 10), hidden: true },
          ]}
          displayFields={['academic_period_name', 'unit_code', 'unit_title', 'status', 'registered_on']}
          displayLabels={{ academic_period_name: 'Academic period', unit_code: 'Unit code', unit_title: 'Unit', registered_on: 'Registered on' }}
          allowEdit={false}
          allowDelete={false}
          baseParams={{ scope: 'self' }}
        />
      </section>
    </PortalShell>
  );
}
