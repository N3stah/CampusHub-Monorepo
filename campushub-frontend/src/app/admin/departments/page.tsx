'use client';

import AdminDepartments from '@/components/AdminDepartments';
import PortalShell from '@/components/PortalShell';

export default function AdminDepartmentsPage() {
  return (
    <PortalShell roles={['admin']}>
      <AdminDepartments />
    </PortalShell>
  );
}
