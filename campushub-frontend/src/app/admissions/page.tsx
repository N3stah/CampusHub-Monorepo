'use client';

import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import PortalShell from '@/components/PortalShell';

const admissionStatuses = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'offered', label: 'Offered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const admissionFilters = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'offered', label: 'Offered' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export default function AdmissionsPage() {
  return (
    <PortalShell roles={['registrar']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Registrar office</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Admissions</h1>
          <p className="mt-2 text-sm text-slate-600">Manage applications from submission through admission decision.</p>
        </header>
        <ApiCrudWorkspace
          title="Applications"
          description="Create applicant records, update programme and review status. Admission records are retained; use status transitions instead of deleting history."
          endpoint="/admissions/applications/"
          fields={[
            { name: 'first_name', label: 'First name', required: true },
            { name: 'last_name', label: 'Last name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phone_number', label: 'Phone number' },
            { name: 'programme_id', label: 'Programme', type: 'number', required: true, lookup: { endpoint: '/academics/courses/', labelFields: ['code', 'title'] } },
            { name: 'status', label: 'Status', options: admissionStatuses, required: true },
            { name: 'notes', label: 'Review notes', type: 'textarea' },
          ]}
          displayFields={['first_name', 'last_name', 'email', 'programme_name', 'status']}
          displayLabels={{ first_name: 'First name', last_name: 'Last name', programme_name: 'Programme', status: 'Application status' }}
          filters={[{ name: 'status', label: 'Status', options: admissionFilters }]}
          sortableFields={[{ value: '-created_at', label: 'Recently received' }, { value: 'first_name', label: 'Applicant name' }]}
          allowDelete={false}
        />
      </section>
    </PortalShell>
  );
}
