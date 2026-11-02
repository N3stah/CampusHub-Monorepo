'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '@/components/PortalShell';
import LecturerDashboard from '@/components/LecturerDashboard';
import StudentDashboard from '@/components/StudentDashboard';
import PlacementOverview from '@/components/PlacementOverview';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'admin') router.replace('/admin');
  }, [router, user?.role]);

  if (user?.role === 'admin') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
        <p className="text-sm font-medium text-slate-500">Opening administration…</p>
      </main>
    );
  }

  return (
    <PortalShell>
      {user?.role === 'student' ? <StudentDashboard /> : user?.role === 'lecturer' ? <LecturerDashboard /> : (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Your campus, connected</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome, {user?.first_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your CampusHub account and a quick route to the resources you need.</p>
        </div>

        <PlacementOverview />

      </section>
      )}
    </PortalShell>
  );
}
