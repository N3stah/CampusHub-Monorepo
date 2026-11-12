'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';

interface AIFeedResponse {
  feed: { summary: string; provider: string; context_role: string };
  cached: boolean;
  generated_at: string;
}

interface AITask {
  type: string;
  description: string;
  required_params: string[];
}

interface AITaskList {
  count: number;
  results: AITask[];
}

interface AIChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string | null;
  created_at?: string;
}

interface AIChatResponse {
  conversation_id: number;
  message: AIChatMessage;
}

interface AIChatHistory {
  conversation_id: number;
  title: string;
  messages: AIChatMessage[];
}

interface AIAnalytics {
  usage: {
    total_task_calls: number;
    calls_today: number;
    by_provider: Record<string, number>;
  };
  models: {
    at_risk: {
      trained: boolean;
      available_rows: number;
      required_rows: number;
      available_offerings: number;
      required_offerings: number;
      status: string;
    };
    placement: {
      trained: boolean;
      available_rows: number;
      required_rows: number;
      status: string;
    };
  };
}

const taskLabels: Record<string, string> = {
  study_plan: 'Personalized study plan',
  assignment_help: 'Assignment hints',
  placement_match: 'Placement match suggestions',
  draft_announcement: 'Draft course announcement',
  generate_quiz: 'Generate quiz questions',
  intervention_plan: 'At-risk student intervention plan',
  grade_analysis: 'Grade analysis',
  match_students: 'Match students to placement',
  outcome_forecast: 'Placement outcome forecast',
  outreach_email: 'Draft employer outreach email',
  system_report: 'System health report',
  resource_allocation: 'Resource allocation suggestions',
  anomaly_detection: 'Unusual pattern analysis',
};

function percentage(available: number, required: number) {
  if (!required) return 0;
  return Math.min(100, Math.round((available / required) * 100));
}

export default function AIPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const storageKey = useMemo(() => user ? `campushub-ai-conversation:${user.id}` : null, [user]);
  const [feed, setFeed] = useState<AIFeedResponse | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AIAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [taskType, setTaskType] = useState('');
  const [taskParams, setTaskParams] = useState<Record<string, string>>({});
  const [taskRunning, setTaskRunning] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ task_type: string; draft: string; provider: string; warning: string } | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const selectedTask = tasks.find((task) => task.type === taskType) ?? null;

  const loadFeed = useCallback(async (signal?: AbortSignal) => {
    setFeedLoading(true);
    try {
      const { data } = await api.get<AIFeedResponse>('/ai/feed/', { signal });
      if (!signal?.aborted) {
        setFeed(data);
        setFeedError(null);
      }
    } catch (requestError) {
      if (!signal?.aborted) setFeedError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setFeedLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get<AITaskList>('/ai/tasks/', { signal });
      if (!signal?.aborted) {
        setTasks(data.results);
        setTaskType((current) => data.results.some((task) => task.type === current) ? current : data.results[0]?.type ?? '');
        setTasksError(null);
      }
    } catch (requestError) {
      if (!signal?.aborted) setTasksError(getApiErrorMessage(requestError));
    }
  }, []);

  const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get<AIAnalytics>('/ai/analytics/', { signal });
      if (!signal?.aborted) {
        setAnalytics(data);
        setAnalyticsError(null);
      }
    } catch (requestError) {
      if (!signal?.aborted) setAnalyticsError(getApiErrorMessage(requestError));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      void loadFeed(controller.signal);
      void loadTasks(controller.signal);
      if (isAdmin) void loadAnalytics(controller.signal);
    });
    return () => controller.abort();
  }, [isAdmin, loadAnalytics, loadFeed, loadTasks]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const storedId = window.localStorage.getItem(storageKey);
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setMessages([]);
      setConversationId(null);
      setHistoryError(null);
      if (!storedId || !/^\d+$/.test(storedId)) return;
      const parsedId = Number(storedId);
      setConversationId(parsedId);
      setHistoryLoading(true);
      try {
        const { data } = await api.get<AIChatHistory>(`/ai/chat/${parsedId}/`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setMessages(data.messages);
          setHistoryError(null);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setHistoryError(getApiErrorMessage(requestError));
          if (window.localStorage.getItem(storageKey) === storedId) window.localStorage.removeItem(storageKey);
          setConversationId(null);
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    });
    return () => controller.abort();
  }, [storageKey]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message || chatSending) return;
    setChatSending(true);
    setHistoryError(null);
    setChatDraft('');
    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [...current, { id: pendingId, role: 'user', content: message }]);
    try {
      const { data } = await api.post<AIChatResponse>('/ai/chat/', {
        message,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      });
      setConversationId(data.conversation_id);
      if (storageKey) window.localStorage.setItem(storageKey, String(data.conversation_id));
      setMessages((current) => [...current, data.message]);
    } catch (requestError) {
      setMessages((current) => current.filter((entry) => entry.id !== pendingId));
      setHistoryError(getApiErrorMessage(requestError));
    } finally {
      setChatSending(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setHistoryError(null);
    if (storageKey) window.localStorage.removeItem(storageKey);
  }

  async function runTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || taskRunning) return;
    setTaskRunning(true);
    setTaskError(null);
    setTaskDraft(null);
    try {
      const params = Object.fromEntries(
        selectedTask.required_params.map((name) => [name, taskParams[name]?.trim() ?? '']),
      );
      const { data } = await api.post<{ task_type: string; draft: string; provider: string; warning: string }>('/ai/task/', {
        task_type: selectedTask.type,
        params,
      });
      setTaskDraft(data);
    } catch (requestError) {
      setTaskError(getApiErrorMessage(requestError));
    } finally {
      setTaskRunning(false);
    }
  }

  async function copyDraft() {
    if (!taskDraft) return;
    setCopyNotice(null);
    try {
      await navigator.clipboard.writeText(taskDraft.draft);
      setCopyNotice('Draft copied. Review and submit it through the relevant CampusHub workflow.');
    } catch {
      setCopyNotice('Could not access the clipboard. Select and copy the draft manually.');
    }
  }

  const feedTime = feed ? new Date(feed.generated_at).toLocaleString() : '';

  return (
    <PortalShell>
      <section className="space-y-7">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CampusHub AI</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Your AI assistant</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Role-aware insights, chat, and reviewable task drafts based on your CampusHub account.</p>
        </header>

        <section aria-labelledby="daily-insight-heading" className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="daily-insight-heading" className="text-lg font-bold text-slate-900">Daily insight</h2>
              <p className="mt-1 text-xs text-slate-500">{feed ? `Updated ${feedTime}${feed.cached ? ' · cached' : ''}` : 'Personalized for your role'}</p>
            </div>
            <button type="button" onClick={() => void loadFeed()} disabled={feedLoading} className="min-h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60">
              {feedLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {feedError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{feedError}</p>}
          {feedLoading && !feed ? <p role="status" className="mt-4 text-sm text-slate-500">Generating your daily insight…</p> : null}
          {feed && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{feed.feed.summary}</p>}
          {feed && <p className="mt-3 text-xs text-slate-400">Generated with {feed.feed.provider} · {feed.feed.context_role} context</p>}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section aria-labelledby="ai-chat-heading" className="flex min-h-[34rem] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ai-chat-heading" className="text-lg font-bold text-slate-900">Ask CampusHub AI</h2>
                <p className="mt-1 text-sm text-slate-600">Conversation history is private to your account.</p>
              </div>
              {messages.length > 0 && <button type="button" disabled={chatSending} onClick={startNewChat} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">New chat</button>}
            </div>
            {historyError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{historyError}</p>}
            <div aria-live="polite" className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
              {historyLoading && <p role="status" className="text-sm text-slate-500">Loading your conversation…</p>}
              {!messages.length && !historyLoading && <p className="py-12 text-center text-sm leading-6 text-slate-500">Ask a question about studying, teaching, placements, or using CampusHub.</p>}
              {messages.map((message) => (
                <article key={message.id} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-blue-700 text-white' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'}`}>
                  <p>{message.content}</p>
                  {message.role === 'assistant' && message.provider && <p className="mt-2 text-[10px] opacity-60">via {message.provider}</p>}
                </article>
              ))}
              {chatSending && <p role="status" className="text-xs text-slate-500">CampusHub AI is responding…</p>}
            </div>
            <form onSubmit={sendMessage} className="mt-3 flex gap-2">
              <label className="sr-only" htmlFor="ai-chat-message">Message CampusHub AI</label>
              <textarea id="ai-chat-message" rows={2} maxLength={4000} disabled={historyLoading} value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Write a message…" className="min-h-12 flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
              <button type="submit" disabled={chatSending || historyLoading || !chatDraft.trim()} className="self-end min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">{chatSending ? 'Sending…' : 'Send'}</button>
            </form>
          </section>

          <section aria-labelledby="ai-tasks-heading" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 id="ai-tasks-heading" className="text-lg font-bold text-slate-900">AI task drafts</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Generate a draft for review. AI never publishes or applies changes for you.</p>
            </div>
            {tasksError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{tasksError}</p>}
            {!tasksError && !tasks.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No AI tasks are configured for this account role yet.</p>}
            {!!tasks.length && (
              <form onSubmit={runTask} className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">Task
                  <select value={taskType} onChange={(event) => { setTaskType(event.target.value); setTaskParams({}); setTaskDraft(null); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                    {tasks.map((task) => <option key={task.type} value={task.type}>{taskLabels[task.type] ?? task.description}</option>)}
                  </select>
                </label>
                {selectedTask && <p className="text-xs leading-5 text-slate-500">{selectedTask.description}</p>}
                {selectedTask?.required_params.map((name) => (
                  <label key={name} className="block text-sm font-medium capitalize text-slate-700">
                    {name.replaceAll('_', ' ')}
                    {name === 'question' || name === 'topics' ? (
                      <textarea required rows={3} value={taskParams[name] ?? ''} onChange={(event) => setTaskParams((current) => ({ ...current, [name]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                    ) : (
                      <input required type={name.endsWith('_id') ? 'number' : 'text'} min={name.endsWith('_id') ? 1 : undefined} value={taskParams[name] ?? ''} onChange={(event) => setTaskParams((current) => ({ ...current, [name]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                    )}
                  </label>
                ))}
                <button type="submit" disabled={taskRunning || !selectedTask || selectedTask.required_params.some((name) => !taskParams[name]?.trim())} className="min-h-11 w-full rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">
                  {taskRunning ? 'Generating draft…' : 'Generate draft'}
                </button>
              </form>
            )}
            {taskError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{taskError}</p>}
            {taskDraft && (
              <article className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">{taskLabels[taskDraft.task_type] ?? taskDraft.task_type}</h3>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">{taskDraft.provider}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{taskDraft.draft}</p>
                <p className="text-xs leading-5 text-amber-900">{taskDraft.warning}</p>
                <button type="button" onClick={() => void copyDraft()} className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100">Copy draft</button>
                {copyNotice && <p role="status" className="text-xs text-slate-600">{copyNotice}</p>}
              </article>
            )}
          </section>
        </div>

        {isAdmin && (
          <section aria-labelledby="ai-analytics-heading" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="ai-analytics-heading" className="text-lg font-bold text-slate-900">AI service analytics</h2>
                <p className="mt-1 text-sm text-slate-600">Usage and machine-learning model readiness.</p>
              </div>
              <button type="button" onClick={() => void loadAnalytics()} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">Refresh analytics</button>
            </div>
            {analyticsError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{analyticsError}</p>}
            {!analytics && !analyticsError && <p role="status" className="text-sm text-slate-500">Loading analytics…</p>}
            {analytics && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Total AI task calls</p><p className="mt-1 text-2xl font-bold text-slate-900">{analytics.usage.total_task_calls}</p></article>
                  <article className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Calls in the last 24 hours</p><p className="mt-1 text-2xl font-bold text-slate-900">{analytics.usage.calls_today}</p></article>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Calls by provider</h3>
                  {Object.keys(analytics.usage.by_provider).length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(analytics.usage.by_provider).map(([provider, count]) => <li key={provider} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">{provider}: {count}</li>)}
                    </ul>
                  ) : <p className="mt-2 text-sm text-slate-500">No task calls recorded.</p>}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    ['At-risk model', analytics.models.at_risk],
                    ['Placement model', analytics.models.placement],
                  ] as const).map(([label, model]) => (
                    <article key={label} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex justify-between gap-3"><h3 className="font-semibold text-slate-900">{label}</h3><span className={`text-xs font-semibold ${model.trained ? 'text-emerald-700' : 'text-amber-800'}`}>{model.trained ? 'Trained' : 'Not trained'}</span></div>
                      <p className="mt-2 text-sm text-slate-600">{model.status}</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${label} training data`} aria-valuenow={percentage(model.available_rows, model.required_rows)} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage(model.available_rows, model.required_rows)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{model.available_rows} / {model.required_rows} training rows</p>
                      {'available_offerings' in model && <p className="mt-1 text-xs text-slate-500">{model.available_offerings} / {model.required_offerings} offerings</p>}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <p className="text-xs leading-5 text-slate-500">AI output may be incomplete or incorrect. Verify important information. Student-specific context is supplied by the backend according to your account.</p>
      </section>
    </PortalShell>
  );
}
