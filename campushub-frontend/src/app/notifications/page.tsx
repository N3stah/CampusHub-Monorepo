'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Notification } from '@/types/portal';

function getInternalHref(link: string | null): string | null {
  if (!link?.startsWith('/') || link.startsWith('//')) return null;

  const applicationLink = link.match(/^\/placements\/\d+\/applications\/(\d+)\/?$/);
  if (applicationLink) return `/applications/${applicationLink[1]}`;

  const baseUrl = 'https://campushub.invalid';
  const target = new URL(link, baseUrl);
  if (target.origin !== baseUrl) return null;
  return `${target.pathname}${target.search}${target.hash}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<number | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const [page, countResponse] = await Promise.all([
        getApiPage<Notification>('/notifications/', {}, signal),
        api.get<{ count: number }>('/notifications/unread-count/', { signal }),
      ]);

      if (!Number.isInteger(countResponse.data.count) || countResponse.data.count < 0) {
        throw new Error('The API returned an invalid unread notification count.');
      }

      setNotifications(page.results);
      setUnreadCount(countResponse.data.count);
      setLoadError(null);
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadNotifications(controller.signal));
    return () => controller.abort();
  }, [loadNotifications]);

  const markAsRead = async (notification: Notification) => {
    setBusyNotificationId(notification.id);
    setActionError(null);
    try {
      await api.patch(`/notifications/${notification.id}/read/`);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, is_read: true } : item
      )));
      if (!notification.is_read) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyNotificationId(null);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAllRead(true);
    setActionError(null);
    try {
      await api.patch('/notifications/read-all/');
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <PortalShell>
      <section className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Updates</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600" aria-live="polite">
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0 || markingAllRead || busyNotificationId !== null}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAllRead ? 'Marking as read…' : 'Mark all as read'}
          </button>
        </header>

        {actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
        {loadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); setLoadError(null); void loadNotifications(); }}
              className="mt-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading notifications…</p>}
        {!loading && !loadError && notifications.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">You’re all caught up. New updates will appear here.</p>
        )}
        {!loadError && notifications.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {notifications.map((notification) => {
              const href = getInternalHref(notification.link);
              return (
                <li key={notification.id} className={`flex items-start gap-4 p-4 sm:p-5 ${notification.is_read ? '' : 'bg-blue-50/50'}`}>
                  <span
                    aria-label={notification.is_read ? 'Read' : 'Unread'}
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? 'bg-slate-300' : 'bg-blue-600'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{notification.verb}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {notification.actor?.name ? `From ${notification.actor.name} · ` : ''}
                      <time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time>
                    </p>
                    {href && (
                      <Link href={href} className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">
                        View update
                      </Link>
                    )}
                  </div>
                  {!notification.is_read && (
                    <button
                      type="button"
                      onClick={() => void markAsRead(notification)}
                      disabled={busyNotificationId !== null || markingAllRead}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Mark "${notification.verb}" as read`}
                    >
                      {busyNotificationId === notification.id ? 'Saving…' : 'Mark read'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}
