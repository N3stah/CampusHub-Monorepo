'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import { useAuth } from '@/context/AuthContext';
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

export default function MessagingPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastMessageId = useRef(0);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const offerings = useMemo(() => units.flatMap((unit) => unit.offerings.map((offering) => ({
    id: offering.offering_id,
    title: `${unit.code} · ${offering.course_code} — ${offering.course_title}`,
  }))), [units]);

  const loadConversations = useCallback(async () => {
    const response = await api.get<{ results: Conversation[] }>('/messaging/conversations/');
    setConversations(response.data.results);
    setSelectedId((current) => current ?? response.data.results[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [conversationResponse, unitPage] = await Promise.all([
          api.get<{ results: Conversation[] }>('/messaging/conversations/', { signal: controller.signal }),
          getApiPage<AcademicUnit>('/academics/units/', {}, controller.signal),
        ]);
        let availableContacts: Contact[];
        let availableGroupUnits = unitPage.results;
        if (user?.role === 'student') {
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
        } else if (user?.role === 'lecturer') {
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
        if (controller.signal.aborted) return;
        setConversations(conversationResponse.data.results);
        setSelectedId(conversationResponse.data.results[0]?.id ?? null);
        setContacts(availableContacts.filter((contact) => contact.id !== user?.id && contact.is_active));
        setUnits(availableGroupUnits);
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
    <PortalShell roles={['student', 'lecturer', 'admin']}>
      <section className="space-y-5">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Campus communication</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Messages</h1><p className="mt-2 text-sm text-slate-600">Message your lecturers or enrolled students, or join a teaching group conversation.</p></header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <form onSubmit={(event) => void startDirect(event)} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <label className="block text-xs font-semibold text-slate-700">Start a direct conversation
                <select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Choose a person</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name} · {contact.role}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busy || !recipientId} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Open chat</button>
            </form>
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Conversations</h2>
              {loading ? <p role="status" className="p-4 text-sm text-slate-500">Loading conversations…</p> : conversations.length ? conversations.map((conversation) => (
                <button type="button" key={conversation.id} onClick={() => { setMessages([]); lastMessageId.current = 0; setSelectedId(conversation.id); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 ${selectedId === conversation.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.title}</span>{conversation.unread_count > 0 && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white">{conversation.unread_count}</span>}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.latest_message?.body ?? (conversation.kind === 'group' ? 'Unit group' : 'No messages yet')}</span>
                </button>
              )) : <p className="p-4 text-sm text-slate-500">No conversations yet.</p>}
            </div>
          </aside>
          <section aria-label="Conversation messages" className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">{selectedConversation?.title ?? 'Select a conversation'}</h2>
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
