'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';

interface PortalShellProps {
  children: ReactNode;
  roles?: User['role'][];
}

const navigation: { label: string; href: string; roles: User['role'][] }[] = [
  { label: 'Overview', href: '/dashboard', roles: ['student', 'lecturer', 'officer', 'admin'] },
  { label: 'My courses', href: '/courses', roles: ['student'] },
  { label: 'Students', href: '/users', roles: ['admin', 'officer'] },
  { label: 'Lecturers', href: '/lecturers', roles: ['admin', 'officer', 'lecturer'] },
  { label: 'Placements', href: '/placements', roles: ['student', 'lecturer', 'officer', 'admin'] },
  { label: 'Administration', href: '/admin', roles: ['admin'] },
  { label: 'Departments', href: '/admin/departments', roles: ['admin'] },
  { label: 'Course management', href: '/admin/courses', roles: ['admin'] },
];

export default function PortalShell({ children, roles }: PortalShellProps) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAccess = Boolean(user && (!roles || roles.includes(user.role)));

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    else if (!loading && user && !hasAccess) router.replace('/dashboard');
  }, [loading, user, hasAccess, router]);

  if (loading || !hasAccess || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
        <p className="text-sm font-medium text-slate-500">Loading your CampusHub…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-blue-700">
            CampusHub
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.first_name} {user.last_name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-8">
        <nav aria-label="Main navigation" className="flex gap-2 overflow-x-auto lg:flex-col">
          {navigation.filter((item) => item.roles.includes(user.role)).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
