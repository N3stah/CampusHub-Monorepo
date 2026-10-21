'use client';

import AdminCourses from '@/components/AdminCourses';
import PortalShell from '@/components/PortalShell';

export default function AdminCoursesPage() {
  return (
    <PortalShell roles={['admin']}>
      <AdminCourses />
    </PortalShell>
  );
}
