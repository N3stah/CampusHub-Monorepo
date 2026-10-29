'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { isRoleAllowed } from '@/lib/role-access';

interface PortalShellProps {
  children: ReactNode;
  roles?: User['role'][];
}

const navigation: { label: string; href: string; roles: User['role'][] }[] = [
  { label: 'Overview', href: '/dashboard', roles: ['student', 'lecturer', 'officer', 'admin'] },
  { label: 'Units', href: '/lecturer/units', roles: ['lecturer'] },
  { label: 'Lesson plan', href: '/lecturer/lessons', roles: ['lecturer'] },
  { label: 'Attendance', href: '/lecturer/attendance', roles: ['lecturer'] },
  { label: 'Learning materials / notes', href: '/lecturer/materials', roles: ['lecturer'] },
  { label: 'Assignments', href: '/assignments', roles: ['student', 'lecturer'] },
  { label: 'My courses', href: '/courses', roles: ['student'] },
  { label: 'Students', href: '/users', roles: ['admin'] },
  { label: 'Lecturers', href: '/lecturers', roles: ['admin'] },
  { label: 'Placements', href: '/placements', roles: ['student', 'officer', 'admin'] },
  { label: 'Applications', href: '/applications', roles: ['student', 'officer', 'admin'] },
  { label: 'Administration', href: '/admin', roles: ['admin'] },
  { label: 'Logs', href: '/admin/logs', roles: ['admin'] },
  { label: 'Schools', href: '/admin/schools', roles: ['admin'] },
  { label: 'Departments', href: '/admin/departments', roles: ['admin'] },
  { label: 'Programmes', href: '/admin/courses', roles: ['admin'] },
  { label: 'Units and teaching', href: '/admin/units', roles: ['admin'] },
  { label: 'Programme admissions', href: '/admin/enrollments', roles: ['admin'] },
];

export default function PortalShell({ children, roles }: PortalShellProps) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAccess = isRoleAllowed(user?.role, roles);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const availableNavigation = user
    ? navigation.filter((item) => item.roles.includes(user.role))
    : [];

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
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-blue-700">
            CampusHub
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={mobileNavigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavigationOpen}
              aria-controls={mobileNavigationOpen ? 'mobile-main-navigation' : undefined}
              onClick={() => setMobileNavigationOpen((open) => !open)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
            >
              {mobileNavigationOpen ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            <Link
              href="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" />
              </svg>
            </Link>
            {user.role === 'lecturer' && (
              <Link
                href="/profile"
                aria-label="Settings"
                title="Settings"
                aria-current={pathname === '/profile' ? 'page' : undefined}
                className={`rounded-lg border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  pathname === '/profile'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-700'
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.55 2.55l-.1-.1a1.8 1.8 0 0 0-3.06 1.27v.28a1.8 1.8 0 1 1-3.6 0v-.15a1.8 1.8 0 0 0-3.06-1.27l-.1.1a1.8 1.8 0 1 1-2.55-2.55l.1-.1a1.8 1.8 0 0 0-1.27-3.06h-.28a1.8 1.8 0 1 1 0-3.6h.15a1.8 1.8 0 0 0 1.27-3.06l-.1-.1A1.8 1.8 0 1 1 7 2.63l.1.1a1.8 1.8 0 0 0 3.06-1.27v-.28a1.8 1.8 0 1 1 3.6 0v.15a1.8 1.8 0 0 0 3.06 1.27l.1-.1a1.8 1.8 0 1 1 2.55 2.55l-.1.1a1.8 1.8 0 0 0 1.27 3.06h.28a1.8 1.8 0 1 1 0 3.6h-.15A1.8 1.8 0 0 0 19.4 15Z" />
                </svg>
              </Link>
            )}
            {user.role !== 'lecturer' && (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {`${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()}
                </span>
                <span className="hidden sm:inline">Profile</span>
              </Link>
            )}
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
      <aside className="fixed bottom-0 left-0 top-16 z-20 hidden w-60 overflow-y-auto border-r border-slate-200 bg-white p-4 lg:block">
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          {availableNavigation.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      {mobileNavigationOpen && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavigationOpen(false)}
            className="absolute inset-0 top-16 bg-slate-950/30"
          />
          <nav id="mobile-main-navigation" aria-label="Main navigation" className="absolute bottom-0 left-0 top-16 w-72 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex flex-col gap-1">
              {availableNavigation.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileNavigationOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
      <main className="fixed bottom-0 left-0 right-0 top-16 overflow-y-auto lg:left-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
