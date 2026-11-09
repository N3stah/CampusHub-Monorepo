'use client';

import AdminSchools from '@/components/AdminSchools';
import PortalShell from '@/components/PortalShell';

export default function AdminSchoolsPage() {
  return (
    <PortalShell roles={['ict_admin']}>
      <AdminSchools />
    </PortalShell>
  );
}
