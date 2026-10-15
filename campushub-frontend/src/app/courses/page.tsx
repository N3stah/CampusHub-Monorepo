'use client';

import MyCourses from '@/components/MyCourses';
import PortalShell from '@/components/PortalShell';

export default function CoursesPage() {
  return (
    <PortalShell roles={['student']}>
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Learning</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My courses</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Open a course to view its lecturer, notes, learning resources, and lecturer updates.</p>
        </div>
        <MyCourses />
      </section>
    </PortalShell>
  );
}
