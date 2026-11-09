'use client';

import AdminUnits from '@/components/AdminUnits';
import PortalShell from '@/components/PortalShell';

export default function AdminUnitsPage() {
  return (
    <PortalShell roles={['ict_admin']}>
      <AdminUnits />
    </PortalShell>
  );
}
