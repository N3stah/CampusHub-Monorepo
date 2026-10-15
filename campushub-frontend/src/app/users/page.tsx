'use client';

import DirectoryPage from '@/components/DirectoryPage';
import PortalShell from '@/components/PortalShell';
import type { DirectoryUser } from '@/types/portal';
import { getDepartmentName } from '@/lib/portal';

const STUDENT_FILTERS = { role: 'student' };

export default function UsersPage() {
  return (
    <PortalShell roles={['admin', 'officer']}>
      <DirectoryPage<DirectoryUser>
        title="Students"
        description="Find student accounts and review their department, GPA, and account status."
        endpoint="/users/"
        filters={STUDENT_FILTERS}
        searchPlaceholder="Search by name, email, or username"
        emptyMessage="No students found. Try changing your search."
        getKey={(student) => student.id}
        columns={[
          {
            label: 'Student',
            render: (student) => (
              <div>
                <p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p>
                <p className="mt-1 text-xs text-slate-500">{student.username}</p>
              </div>
            ),
          },
          { label: 'Email', render: (student) => <span className="text-slate-600">{student.email}</span> },
          { label: 'Department', render: (student) => <span className="text-slate-600">{getDepartmentName(student.department)}</span> },
          { label: 'GPA', render: (student) => <span className="text-slate-600">{student.gpa ?? '—'}</span> },
          {
            label: 'Status',
            render: (student) => (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {student.is_active ? 'Active' : 'Inactive'}
              </span>
            ),
          },
        ]}
      />
    </PortalShell>
  );
}
