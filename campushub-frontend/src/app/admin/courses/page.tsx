'use client';

import AdminCourses from '@/components/AdminCourses';
import PortalShell from '@/components/PortalShell';

export default function AdminCoursesPage() {
  return (
    <PortalShell roles={['ict_admin']}>
      <AdminCourses />
    </PortalShell>
  );
}
