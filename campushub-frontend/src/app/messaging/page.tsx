'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import { useAuth } from '@/context/AuthContext';
import { roleLabels as campusRoleLabels } from '@/lib/role-access';
import type { CampusRole } from '@/types';
import type { AcademicUnit, DirectoryUser } from '@/types/portal';

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_profile_picture_url: string | null;
  body: string;
  created_at: string;
  is_deleted: boolean;
}

interface Conversation {
  id: number;
  kind: 'direct' | 'group';
  title: string;
  offering_id?: number;
  unread_count: number;
  latest_message: ChatMessage | null;
}
interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface BroadcastRecipient {
  id: number;
  first_name: string;
  last_name: string;
}

type BroadcastAudience = 'all' | CampusRole;

const broadcastRoles: CampusRole[] = [
  'student',
  'lecturer',
  'officer',
  'admin',
  'ict_admin',
  'registrar',
  'finance',
  'hod',
  'examination',
  'librarian',
  'hostel',
];

const broadcastAudienceOptions: { value: BroadcastAudience; label: string }[] = [
  { value: 'all', label: 'All active campus users' },
  ...broadcastRoles.map((role) => ({ value: role, label: campusRoleLabels[role] })),
];

function isBroadcastAudience(value: string): value is BroadcastAudience {
  return broadcastAudienceOptions.some((option) => option.value === value);
}

export default function MessagingPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [broadcastRecipients, setBroadcastRecipients] = useState<BroadcastRecipient[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [audienceRole, setAudienceRole] = useState<BroadcastAudience | ''>('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
  const [selectAllRecipients, setSelectAllRecipients] = useState(false);
  const [confirmAllRecipients, setConfirmAllRecipients] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [recipientId, setRecipientId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastMessageId = useRef(0);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const offerings = useMemo(() => units.flatMap((unit) => unit.offerings.map((offering) => ({
    id: offering.offering_id,
    title: `${unit.code} · ${offering.course_code} — ${offering.course_title}`,
  }))), [units]);
  const visibleRecipients = useMemo(() => {
    const query = recipientSearch.trim().toLocaleLowerCase();
    if (!query) return broadcastRecipients;
    return broadcastRecipients.filter((recipient) => (
      `${recipient.first_name} ${recipient.last_name}`.toLocaleLowerCase().includes(query)
    ));
  }, [broadcastRecipients, recipientSearch]);

  const loadConversations = useCallback(async () => {
    const response = await api.get<{ results: Conversation[] }>('/messaging/conversations/');
    setConversations(response.data.results);
    setSelectedId((current) => (
      current && response.data.results.some((conversation) => conversation.id === current)
        ? current
        : response.data.results[0]?.id ?? null
    ));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const conversationResponse = await api.get<{ results: Conversation[] }>('/messaging/conversations/', { signal: controller.signal });
        let availableContacts: Contact[] = [];
        let availableGroupUnits: AcademicUnit[] = [];
        if (user?.role === 'student' || user?.role === 'lecturer' || user?.role === 'admin') {
          const unitPage = await getApiPage<AcademicUnit>('/academics/units/', {}, controller.signal);
          availableGroupUnits = unitPage.results;
          if (user.role === 'student') {
            const [lecturerPage, enrollmentPage] = await Promise.all([
              getApiPage<DirectoryUser>('/lecturers/', {}, controller.signal),
              getApiPage<{ course_id: number; status: string }>('/academics/enrollments/', {}, controller.signal),
            ]);
            const activeCourseIds = new Set(enrollmentPage.results.filter((enrollment) => enrollment.status === 'active').map((enrollment) => enrollment.course_id));
            const eligibleOfferings = (unit: AcademicUnit) => unit.offerings.filter((offering) => offering.is_active && activeCourseIds.has(offering.course_id));
            const assignedLecturerIds = new Set(unitPage.results.flatMap((unit) => eligibleOfferings(unit)
              .flatMap((offering) => offering.lecturers.map((lecturer) => lecturer.id))));
            availableContacts = lecturerPage.results.filter((lecturer) => assignedLecturerIds.has(lecturer.id));
            availableGroupUnits = unitPage.results.map((unit) => ({ ...unit, offerings: eligibleOfferings(unit) })).filter((unit) => unit.offerings.length > 0);
          } else if (user.role === 'lecturer') {
            const response = await api.get<{ results: { student_id: number; student_name: string; student_email: string }[] }>('/academics/lecturer/placements/', { signal: controller.signal });
            availableContacts = [...new Map(response.data.results.map((student) => {
              const [first_name, ...rest] = student.student_name.split(' ');
              return [student.student_id, {
                id: student.student_id,
                first_name,
                last_name: rest.join(' '),
                email: student.student_email,
                role: 'student',
                is_active: true,
              }];
            })).values()];
            availableGroupUnits = unitPage.results.map((unit) => ({
              ...unit,
              offerings: unit.offerings.filter((offering) => offering.is_active && offering.lecturers.some((lecturer) => lecturer.id === user.id)),
            })).filter((unit) => unit.offerings.length > 0);
          } else {
            const usersPage = await getApiPage<DirectoryUser>('/users/', {}, controller.signal);
            availableContacts = usersPage.results;
          }
        }
        if (controller.signal.aborted) return;
        setConversations(conversationResponse.data.results);
        const requestedConversationId = Number(new URLSearchParams(window.location.search).get('conversation'));
        const requestedConversation = conversationResponse.data.results.find((conversation) => conversation.id === requestedConversationId);
        setSelectedId(requestedConversation?.id ?? conversationResponse.data.results[0]?.id ?? null);
        setContacts(availableContacts.filter((contact) => contact.id !== user?.id && contact.is_active));
        setUnits(availableGroupUnits);
        if (user?.role === 'lecturer' || user?.role === 'admin' || user?.role === 'ict_admin') {
          setAudienceRole((current) => current || (user.role === 'lecturer' ? 'student' : 'lecturer'));
        }
        setError(null);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!audienceRole) return;

    const controller = new AbortController();
    const loadRecipients = async () => {
      setLoadingRecipients(true);
      setError(null);
      try {
        const recipients: BroadcastRecipient[] = [];
        let page = 1;
        let hasNextPage = true;
        while (hasNextPage) {
          const response = await getApiPage<Contact>(
            '/messaging/recipients/',
            { role: audienceRole, page, page_size: 100 },
            controller.signal,
          );
          recipients.push(...response.results);
          hasNextPage = response.next !== null;
          page += 1;
        }
        if (!controller.signal.aborted) setBroadcastRecipients(recipients);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoadingRecipients(false);
      }
    };
    void loadRecipients();
    return () => controller.abort();
  }, [audienceRole]);

  const loadMessages = useCallback(async (conversationId: number, append = false) => {
    try {
      const lastId = append ? lastMessageId.current : undefined;
      const response = await api.get<{ results: ChatMessage[] }>(
        `/messaging/conversations/${conversationId}/messages/`,
        { params: lastId ? { after: lastId } : undefined },
      );
      setMessages((current) => {
        const next = append
          ? [...current, ...response.data.results.filter((message) => !current.some((item) => item.id === message.id))]
          : response.data.results;
        lastMessageId.current = next[next.length - 1]?.id ?? 0;
        return next;
      });
      await api.patch(`/messaging/conversations/${conversationId}/read/`);
      setConversations((current) => current.map((conversation) => conversation.id === conversationId
        ? {
          ...conversation,
          unread_count: 0,
          latest_message: response.data.results.at(-1) ?? conversation.latest_message,
        }
        : conversation));
      window.dispatchEvent(new Event('campushub:notifications-updated'));
      setError(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      lastMessageId.current = 0;
      return;
    }
    lastMessageId.current = 0;
    void Promise.resolve().then(() => loadMessages(selectedId));
    const interval = window.setInterval(() => void loadMessages(selectedId, true), 5000);
    return () => window.clearInterval(interval);
  }, [selectedId, loadMessages]);

  async function startDirect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<Conversation>('/messaging/conversations/direct/', { recipient_id: Number(recipientId) });
      await loadConversations();
      setMessages([]);
      lastMessageId.current = 0;
      setSelectedId(response.data.id);
      setRecipientId('');
      setNotice(`Conversation opened with ${response.data.title}.`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function sendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audienceRole || (!selectAllRecipients && selectedRecipientIds.length === 0) || !broadcastDraft.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.post<{ delivery: 'chat' | 'notification'; recipient_count: number }>('/messaging/broadcast/', {
        role: audienceRole,
        ...(selectAllRecipients ? {} : { recipient_ids: selectedRecipientIds }),
        ...(audienceRole === 'all' && selectAllRecipients ? { confirm_all: confirmAllRecipients } : {}),
        body: broadcastDraft.trim(),
        allow_replies: allowReplies,
      });
      setBroadcastDraft('');
      setSelectedRecipientIds([]);
      setSelectAllRecipients(false);
      setConfirmAllRecipients(false);
      setNotice(
        `Sent to ${response.data.recipient_count} ${response.data.recipient_count === 1 ? 'recipient' : 'recipients'} as ${response.data.delivery === 'chat' ? 'private chats' : 'notifications'}.`,
      );
      if (response.data.delivery === 'chat') await loadConversations();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  function toggleRecipient(id: number) {
    if (selectAllRecipients) {
      setSelectAllRecipients(false);
      setSelectedRecipientIds(broadcastRecipients
        .filter((recipient) => recipient.id !== id)
        .map((recipient) => recipient.id));
      return;
    }
    setSelectedRecipientIds((current) => (
      current.includes(id) ? current.filter((recipientId) => recipientId !== id) : [...current, id]
    ));
  }

  async function openGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offeringId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.get<Conversation>(`/messaging/offerings/${offeringId}/group-conversation/`);
      await loadConversations();
      setMessages([]);
      lastMessageId.current = 0;
      setSelectedId(response.data.id);
      setOfferingId('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<ChatMessage>(`/messaging/conversations/${selectedId}/messages/`, { body: draft.trim() });
      setMessages((current) => [...current, response.data]);
      setDraft('');
      await loadConversations();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(messageId: number) {
    try {
      await api.delete(`/messaging/messages/${messageId}/`);
      setMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  return (
    <PortalShell roles={['student', 'lecturer', 'admin', 'ict_admin']}>
      <section className="space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-800 p-6 text-white shadow-lg shadow-blue-950/10 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Campus communication</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Messages</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Keep conversations personal or share an update with an entire campus audience.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/10 px-3 py-1.5">{conversations.length} conversations</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{conversations.reduce((total, item) => total + item.unread_count, 0)} unread</span>
          </div>
        </header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {user && user.role !== 'student' && (
          <form onSubmit={(event) => void sendBroadcast(event)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Audience message</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Reach a group</h2>
              <p className="mt-1 text-sm text-slate-500">Choose who receives your message and whether they can reply.</p>
            </div>
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Send to
                  <select
                    value={audienceRole}
                    onChange={(event) => {
                      const role = event.target.value;
                      setAudienceRole(isBroadcastAudience(role) ? role : '');
                      setBroadcastRecipients([]);
                      setSelectedRecipientIds([]);
                      setSelectAllRecipients(false);
                      setConfirmAllRecipients(false);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {user.role === 'admin'
                      ? broadcastAudienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)
                      : user.role === 'ict_admin'
                        ? <>
                          <option value="lecturer">Lecturers</option>
                          <option value="student">Students</option>
                        </>
                        : <option value="student">Students</option>}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Message
                  <textarea
                    rows={5}
                    maxLength={allowReplies ? 5000 : 255}
                    value={broadcastDraft}
                    onChange={(event) => setBroadcastDraft(event.target.value)}
                    placeholder="Write an announcement or start a conversation…"
                    className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm leading-6 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <p className="text-right text-xs text-slate-400">{broadcastDraft.length}/{allowReplies ? 5000 : 255}</p>
                {!allowReplies && broadcastDraft.trim().length > 255 && (
                  <p role="alert" className="-mt-3 text-xs font-medium text-red-700">Shorten the message to 255 characters or fewer for a notification.</p>
                )}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <input
                    type="checkbox"
                    checked={allowReplies}
                    onChange={(event) => setAllowReplies(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Allow replies</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">Replies open a private chat between you and each recipient.</span>
                  </span>
                </label>
                <p className="text-xs leading-5 text-slate-500">
                  {allowReplies ? 'Sent as individual chats. Recipients cannot see who else received it.' : 'Sent to each recipient’s notification inbox. Replies are disabled.'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Recipients</p>
                    <p className="text-xs text-slate-500" aria-live="polite">
                      {loadingRecipients ? 'Loading people…' : `${broadcastRecipients.length} ${audienceRole === 'all' ? 'active campus users' : `active ${campusRoleLabels[audienceRole || 'student']} accounts`}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectAllRecipients(!selectAllRecipients);
                      setSelectedRecipientIds([]);
                      setConfirmAllRecipients(false);
                    }}
                    disabled={loadingRecipients || broadcastRecipients.length === 0}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {selectAllRecipients ? 'Clear selection' : `Select all ${broadcastRecipients.length}`}
                  </button>
                </div>
                <label className="block border-b border-slate-100 p-3">
                  <span className="sr-only">Search recipients</span>
                  <input
                    type="search"
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Search by name"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <div className="max-h-64 overflow-y-auto p-2" aria-label="Select message recipients">
                  {loadingRecipients ? (
                    <p className="p-4 text-center text-sm text-slate-500">Loading recipients…</p>
                  ) : visibleRecipients.length ? visibleRecipients.map((recipient) => (
                    <label key={recipient.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectAllRecipients || selectedRecipientIds.includes(recipient.id)}
                        onChange={() => toggleRecipient(recipient.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{recipient.first_name} {recipient.last_name}</span>
                      </span>
                    </label>
                  )) : <p className="p-4 text-center text-sm text-slate-500">No matching recipients.</p>}
                </div>
                {audienceRole === 'all' && selectAllRecipients && (
                  <label className="flex cursor-pointer items-start gap-3 border-t border-amber-200 bg-amber-50 p-3.5">
                    <input
                      type="checkbox"
                      checked={confirmAllRecipients}
                      onChange={(event) => setConfirmAllRecipients(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-blue-700 focus:ring-blue-600"
                    />
                    <span className="text-xs leading-5 text-amber-900">
                      I confirm this message should go to all {broadcastRecipients.length} active campus users.
                    </span>
                  </label>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-3.5">
                  <p className="text-xs font-medium text-slate-500">
                    {selectAllRecipients ? `All ${broadcastRecipients.length} selected` : `${selectedRecipientIds.length} selected`}
                  </p>
                  <button
                    type="submit"
                    disabled={busy || loadingRecipients || (!selectAllRecipients && selectedRecipientIds.length === 0) || (audienceRole === 'all' && selectAllRecipients && !confirmAllRecipients) || !broadcastDraft.trim() || (!allowReplies && broadcastDraft.trim().length > 255)}
                    className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : allowReplies ? 'Send as chat' : 'Send notification'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
        <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            {contacts.length > 0 && <form onSubmit={(event) => void startDirect(event)} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <label className="block text-xs font-semibold text-slate-700">Start a direct conversation
                <select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Choose a person</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name} · {contact.role}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busy || !recipientId} className="w-full rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50">Open chat</button>
            </form>}
            {offerings.length > 0 && (
              <form onSubmit={(event) => void openGroup(event)} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <label className="block text-xs font-semibold text-slate-700">Open a unit group
                  <select required value={offeringId} onChange={(event) => setOfferingId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Choose a unit</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.title}</option>)}
                  </select>
                </label>
                <button type="submit" disabled={busy || !offeringId} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Open group chat</button>
              </form>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold">Conversations</h2>
              {loading ? <p role="status" className="p-4 text-sm text-slate-500">Loading conversations…</p> : conversations.length ? conversations.map((conversation) => (
                <button type="button" key={conversation.id} onClick={() => { setMessages([]); lastMessageId.current = 0; setSelectedId(conversation.id); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 ${selectedId === conversation.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.title}</span>{conversation.unread_count > 0 && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white">{conversation.unread_count}</span>}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.latest_message?.body ?? (conversation.kind === 'group' ? 'Unit group' : 'No messages yet')}</span>
                </button>
              )) : <p className="p-4 text-sm text-slate-500">No conversations yet.</p>}
            </div>
          </aside>
          <section aria-label="Conversation messages" className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-5 py-4 font-bold">{selectedConversation?.title ?? 'Select a conversation'}</h2>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {selectedConversation ? messages.map((message) => (
                <article key={message.id} className={`max-w-[85%] rounded-xl px-4 py-3 ${message.sender_id === user?.id ? 'ml-auto bg-blue-700 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  <p className={`text-xs font-semibold ${message.sender_id === user?.id ? 'text-blue-100' : 'text-slate-500'}`}>{message.sender_name} · {new Date(message.created_at).toLocaleString()}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
                  {message.sender_id === user?.id && <button type="button" onClick={() => void deleteMessage(message.id)} className="mt-2 text-xs underline">Delete</button>}
                </article>
              )) : <p className="pt-20 text-center text-sm text-slate-500">Choose or start a conversation to view messages.</p>}
            </div>
            {selectedConversation && <form onSubmit={(event) => void sendMessage(event)} className="flex gap-2 border-t border-slate-100 p-3">
              <label className="sr-only" htmlFor="message-draft">Write a message</label>
              <textarea id="message-draft" rows={2} maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" className="min-w-0 flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" disabled={busy || !draft.trim()} className="self-end rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Send</button>
            </form>}
          </section>
        </div>
      </section>
    </PortalShell>
  );
}
