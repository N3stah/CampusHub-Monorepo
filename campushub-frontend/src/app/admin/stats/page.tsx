'use client';

import AdminCampusStats from '@/components/AdminCampusStats';
import PortalShell from '@/components/PortalShell';

export default function AdminStatsPage() {
  return (
    <PortalShell roles={['admin']}>
      <AdminCampusStats />
    </PortalShell>
  );
}
