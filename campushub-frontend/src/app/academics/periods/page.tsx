'use client';

import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import PortalShell from '@/components/PortalShell';

export default function AcademicPeriodsPage() {
  return (
    <PortalShell roles={['registrar']}>
      <section className="space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Academic administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Academic years and semesters</h1></header>
        <ApiCrudWorkspace
          title="Academic periods"
          description="Maintain academic-year dates and semester status used by registration and teaching."
          endpoint="/academics/periods/"
          fields={[
            { name: 'academic_year', label: 'Academic year', placeholder: '2027/2028', required: true },
            { name: 'name', label: 'Term / semester', placeholder: 'Semester 1', required: true },
            { name: 'starts_on', label: 'Starts', type: 'date', required: true },
            { name: 'ends_on', label: 'Ends', type: 'date', required: true },
            { name: 'status', label: 'Status', options: [{ value: 'planned', label: 'Planned' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }], required: true },
          ]}
          displayFields={['academic_year', 'name', 'starts_on', 'ends_on', 'status']}
          filters={[{ name: 'status', label: 'Status', options: [{ value: 'planned', label: 'Planned' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }] }]}
          sortableFields={[{ value: 'starts_on', label: 'Start date' }, { value: '-starts_on', label: 'Newest first' }]}
          allowDelete={false}
        />
      </section>
    </PortalShell>
  );
}
