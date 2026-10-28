'use client';

import AdminAdmissions from '@/components/AdminAdmissions';
import PortalShell from '@/components/PortalShell';

export default function AdminAdmissionsPage() {
  return (
    <PortalShell roles={['admin']}>
      <AdminAdmissions />
    </PortalShell>
  );
}
