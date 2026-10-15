'use client';

import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import StudentDashboard from '@/components/StudentDashboard';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <PortalShell>
      {user?.role === 'student' ? <StudentDashboard /> : (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Your campus, connected</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome, {user?.first_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your CampusHub account and a quick route to the resources you need.</p>
        </div>

        <section aria-labelledby="profile-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 id="profile-heading" className="text-lg font-semibold">Your profile</h2>
              <p className="mt-1 text-sm text-slate-500">Account information currently available from your profile.</p>
            </div>
            {user && (
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">{user.role}</span>
            )}
          </div>
          {user && (
            <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                ['Name', `${user.first_name} ${user.last_name}`],
                ['Email', user.email],
                ['Username', user.username],
                ['Member since', new Date(user.date_joined).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section aria-labelledby="quick-links-heading">
          <h2 id="quick-links-heading" className="mb-3 font-semibold">Quick links</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/lecturers" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300">
              <p className="font-semibold">Lecturer directory</p>
              <p className="mt-1 text-sm text-slate-500">Find lecturers and their departments.</p>
            </Link>
            <Link href="/placements" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300">
              <p className="font-semibold">Placements</p>
              <p className="mt-1 text-sm text-slate-500">Explore opportunities and follow application steps.</p>
            </Link>
            {(user?.role === 'admin' || user?.role === 'officer') && (
              <Link href="/users" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300">
                <p className="font-semibold">Student accounts</p>
                <p className="mt-1 text-sm text-slate-500">Search student accounts and check their status.</p>
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link href="/admin" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300">
                <p className="font-semibold">Administration</p>
                <p className="mt-1 text-sm text-slate-500">Review portal metrics and recent activity.</p>
              </Link>
            )}
          </div>
        </section>
      </section>
      )}
    </PortalShell>
  );
}
