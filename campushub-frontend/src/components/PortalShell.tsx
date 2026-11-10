'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { isRoleAllowed, roleLabels } from '@/lib/role-access';
import api from '@/lib/api';

interface PortalShellProps {
  children: ReactNode;
  roles?: User['role'][];
}

const navigation: { label: string; href: string; roles: User['role'][] }[] = [
  { label: 'Overview', href: '/dashboard', roles: ['student', 'lecturer', 'officer', 'finance', 'hod', 'examination'] },
  { label: 'Registrar office', href: '/registrar', roles: ['registrar'] },
  { label: 'Library management', href: '/library', roles: ['librarian'] },
  { label: 'Hostel management', href: '/hostels', roles: ['hostel'] },
  { label: 'CampusHub AI', href: '/ai', roles: ['student', 'lecturer', 'officer', 'admin'] },
  { label: 'Units', href: '/lecturer/units', roles: ['lecturer'] },
  { label: 'Lesson plan', href: '/lecturer/lessons', roles: ['lecturer'] },
  { label: 'Attendance', href: '/lecturer/attendance', roles: ['lecturer'] },
  { label: 'Learning materials / notes', href: '/lecturer/materials', roles: ['lecturer'] },
  { label: 'Assignments', href: '/assignments', roles: ['student', 'lecturer'] },
  { label: 'Messages', href: '/messaging', roles: ['student', 'lecturer', 'admin'] },
  { label: 'Student placements', href: '/lecturer/placements', roles: ['lecturer'] },
  { label: 'My courses', href: '/courses', roles: ['student'] },
  { label: 'Semester registration', href: '/academics/registration', roles: ['student', 'registrar'] },
  { label: 'Academic periods', href: '/academics/periods', roles: ['registrar'] },
  { label: 'Finance', href: '/finance', roles: ['student', 'finance'] },
  { label: 'Examinations & grades', href: '/examinations', roles: ['student', 'lecturer', 'examination', 'registrar'] },
  { label: 'Admissions', href: '/admissions', roles: ['registrar'] },
  { label: 'Register student account', href: '/registrar/students', roles: ['registrar'] },
  { label: 'Credential verification', href: '/verify', roles: ['student', 'registrar'] },
  { label: 'Hostels', href: '/hostels', roles: ['student', 'hostel'] },
  { label: 'Library', href: '/library', roles: ['student', 'librarian'] },
  { label: 'ICT Administration', href: '/ict-admin', roles: ['ict_admin'] },
  { label: 'Super Admin', href: '/admin', roles: ['admin'] },
  { label: 'Schools', href: '/admin/schools', roles: ['ict_admin'] },
  { label: 'Departments', href: '/admin/departments', roles: ['ict_admin'] },
  { label: 'Programmes', href: '/admin/courses', roles: ['ict_admin'] },
  { label: 'Units and teaching', href: '/admin/units', roles: ['ict_admin'] },
  { label: 'Programme admissions', href: '/admin/enrollments', roles: ['registrar'] },
  { label: 'Campus stats', href: '/admin/stats', roles: ['admin'] },
  { label: 'Placement outcomes', href: '/placement-outcomes', roles: ['admin', 'officer'] },
  { label: 'User accounts', href: '/users', roles: ['admin'] },
  { label: 'Lecturers', href: '/lecturers', roles: ['admin'] },
  { label: 'Placements', href: '/placements', roles: ['student', 'officer'] },
  { label: 'Applications', href: '/applications', roles: ['student', 'officer'] },
  { label: 'Logs', href: '/admin/logs', roles: ['admin'] },
];

export default function PortalShell({ children, roles }: PortalShellProps) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAccess = isRoleAllowed(user?.role, roles);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const availableNavigation = user
    ? navigation.filter((item) => item.roles.includes(user.role))
    : [];

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadUnreadCount = async () => {
      try {
        const response = await api.get<{ count: number }>('/notifications/unread-count/');
        if (active) setUnreadNotificationCount(response.data.count);
      } catch {
        // Keep the last known count if the unread-count request fails.
      }
    };
    void loadUnreadCount();
    const interval = window.setInterval(() => void loadUnreadCount(), 30_000);
    window.addEventListener('campushub:notifications-updated', loadUnreadCount);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('campushub:notifications-updated', loadUnreadCount);
    };
  }, [user]);

  useEffect(() => {
    if (!loading && user?.must_change_password && pathname !== '/change-password') router.replace('/change-password');
    else if (!loading && !user) router.replace('/login');
    else if (!loading && user && !hasAccess) router.replace('/dashboard');
  }, [loading, pathname, user, hasAccess, router]);

  if (loading || !hasAccess || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" aria-live="polite">
        <p className="text-sm font-medium text-slate-500">Loading your CampusHub…</p>
      </main>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.02] backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">C</span>
            <span>Campus<span className="text-blue-700">Hub</span></span>
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            {user && (
              <span className="hidden max-w-40 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 xl:inline">
                {roleLabels[user.role]}
              </span>
            )}
            <button
              type="button"
              aria-label={mobileNavigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavigationOpen}
              aria-controls={mobileNavigationOpen ? 'mobile-main-navigation' : undefined}
              onClick={() => setMobileNavigationOpen((open) => !open)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
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
              className="relative rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" />
              </svg>
              {unreadNotificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
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
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-2.5"
              >
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {`${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()}
                </span>
                <span className="hidden sm:inline">Profile</span>
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-3"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5m5 5H3m9-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
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
                className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
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
          <nav id="mobile-main-navigation" aria-label="Main navigation" className="absolute bottom-0 left-0 top-16 w-72 max-w-[85vw] overflow-y-auto border-r border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
            <div className="flex flex-col gap-1">
              {availableNavigation.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileNavigationOpen(false)}
                    className={`min-h-11 rounded-xl px-3 py-3 text-sm font-semibold transition ${
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
        <div className="portal-content mx-auto min-w-0 max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
