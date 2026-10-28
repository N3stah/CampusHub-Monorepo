'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { downloadBlob, getDownloadFilename } from '@/lib/application-files';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AssignmentSubmission, UnitAssignment } from '@/types/portal';

function countdown(dueAt: string, now: number) {
  const difference = new Date(dueAt).getTime() - now;
  if (difference <= 0) return 'Past due';
  const days = Math.floor(difference / 86_400_000);
  const hours = Math.floor((difference % 86_400_000) / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  return days ? `${days}d ${hours}h remaining` : `${hours}h ${minutes}m remaining`;
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.floor(Math.abs(milliseconds) / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'less than 1m';
}

function submissionTiming(submittedAt: string, dueAt: string) {
  const difference = Date.parse(dueAt) - Date.parse(submittedAt);
  return difference >= 0
    ? `Submitted early by ${formatDuration(difference)}`
    : `Submitted late by ${formatDuration(difference)}`;
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<UnitAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [submissions, setSubmissions] = useState<Record<number, AssignmentSubmission | null>>({});
  const [submissionLoading, setSubmissionLoading] = useState<Record<number, boolean>>({});
  const [submissionErrors, setSubmissionErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<number, string>>({});
  const [submitNotices, setSubmitNotices] = useState<Record<number, string>>({});

  const loadAssignments = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await getApiPage<UnitAssignment>('/academics/assignments/', {}, signal);
      setAssignments(page.results);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAssignments(controller.signal));
    return () => controller.abort();
  }, [loadAssignments]);

  useEffect(() => {
    if (user?.role !== 'student' || !assignments.length) return;
    const controller = new AbortController();
    setSubmissionLoading(Object.fromEntries(assignments.map(({ id }) => [id, true])));
    void Promise.all(assignments.map(async (assignment) => {
      try {
        const response = await api.get<{ submission: AssignmentSubmission | null }>(
          `/academics/assignments/${assignment.id}/submission/`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setSubmissions((current) => ({ ...current, [assignment.id]: response.data.submission }));
          setSubmissionErrors((current) => {
            const next = { ...current };
            delete next[assignment.id];
            return next;
          });
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setSubmissionErrors((current) => ({ ...current, [assignment.id]: getApiErrorMessage(requestError) }));
        }
      } finally {
        if (!controller.signal.aborted) {
          setSubmissionLoading((current) => ({ ...current, [assignment.id]: false }));
        }
      }
    }));
    return () => controller.abort();
  }, [assignments, user?.role]);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  async function submitAssignment(event: FormEvent<HTMLFormElement>, assignment: UnitAssignment) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting((current) => ({ ...current, [assignment.id]: true }));
    setSubmitErrors((current) => ({ ...current, [assignment.id]: '' }));
    setSubmitNotices((current) => ({ ...current, [assignment.id]: '' }));
    try {
      let response;
      if (assignment.assignment_type === 'quiz') {
        const answers: Record<string, number> = {};
        for (const question of assignment.questions) {
          const answer = formData.get(`question-${question.id}`);
          if (typeof answer !== 'string') throw new Error('Answer every question before submitting.');
          answers[String(question.id)] = Number(answer);
        }
        response = await api.post<{ submission: AssignmentSubmission }>(
          `/academics/assignments/${assignment.id}/submission/`,
          { answers },
        );
      } else {
        const file = formData.get('file');
        if (!(file instanceof File) || !file.size) throw new Error('Choose a file to submit.');
        const payload = new FormData();
        payload.append('file', file);
        response = await api.post<{ submission: AssignmentSubmission }>(
          `/academics/assignments/${assignment.id}/submission/`,
          payload,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      }
      setSubmissions((current) => ({ ...current, [assignment.id]: response.data.submission }));
      setSubmitNotices((current) => ({ ...current, [assignment.id]: 'Your work has been submitted.' }));
      form.reset();
    } catch (requestError) {
      setSubmitErrors((current) => ({ ...current, [assignment.id]: getApiErrorMessage(requestError) }));
    } finally {
      setSubmitting((current) => ({ ...current, [assignment.id]: false }));
    }
  }

  async function downloadSubmission(assignment: UnitAssignment, submission: AssignmentSubmission) {
    try {
      const response = await api.get<Blob>(
        `/academics/assignments/${assignment.id}/submission/download/`,
        { responseType: 'blob' },
      );
      downloadBlob(
        response.data,
        getDownloadFilename(response.headers['content-disposition'], submission.file_name ?? 'assignment-submission'),
      );
    } catch (requestError) {
      setSubmitErrors((current) => ({ ...current, [assignment.id]: getApiErrorMessage(requestError) }));
    }
  }

  const orderedAssignments = [...assignments].sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));

  return (
    <PortalShell roles={['student', 'lecturer']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{user?.role === 'student' ? 'Your learning' : 'Teaching'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{user?.role === 'student' ? 'Submit your finished work or complete a quiz, and track each deadline.' : 'Assignments and deadlines for your assigned units.'}</p>
        </header>
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading assignments…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><p role="alert" className="text-sm text-red-800">{error}</p><button type="button" onClick={() => { setLoading(true); void loadAssignments(); }} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button></div>
        ) : orderedAssignments.length ? (
          <ol className="space-y-3">
            {orderedAssignments.map((assignment) => {
              const isPastDue = Date.parse(assignment.due_at) <= now;
              const submission = submissions[assignment.id];
              return (
                <li key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{assignment.unit_code} · {assignment.course_code}</p>
                      <h2 className="mt-1 text-lg font-semibold">{assignment.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{assignment.unit_title} · {assignment.max_points} points · {assignment.assignment_type === 'quiz' ? 'Multiple-choice quiz' : 'File submission'}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-500">Due {new Date(assignment.due_at).toLocaleString()}</p>
                      <p className={`mt-1 text-sm font-bold ${isPastDue ? 'text-red-700' : 'text-amber-800'}`} aria-live="polite">{countdown(assignment.due_at, now)}</p>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{assignment.instructions}</p>
                  {user?.role === 'student' && (
                    <section aria-label={`Submit ${assignment.title}`} className="mt-5 border-t border-slate-100 pt-4">
                      {submissionLoading[assignment.id] ? (
                        <p role="status" className="text-sm text-slate-500">Checking your submission…</p>
                      ) : submissionErrors[assignment.id] ? (
                        <p role="alert" className="text-sm text-red-700">{submissionErrors[assignment.id]}</p>
                      ) : (
                        <>
                          {submission && (
                            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                              <p className="text-sm font-semibold text-emerald-900">{submissionTiming(submission.submitted_at, assignment.due_at)}</p>
                              <p className="mt-1 text-xs text-emerald-800">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
                              {submission.file_name && (
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  <span className="text-sm text-emerald-900">{submission.file_name}</span>
                                  <button type="button" onClick={() => void downloadSubmission(assignment, submission)} className="text-sm font-semibold text-emerald-900 underline">Download your submission</button>
                                </div>
                              )}
                              {submission.score !== null && <p className="mt-2 text-sm font-semibold text-emerald-900">Score: {submission.score} / {assignment.max_points}</p>}
                              {submission.feedback && <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900"><span className="font-semibold">Lecturer feedback: </span>{submission.feedback}</p>}
                            </div>
                          )}
                          {submitNotices[assignment.id] && <p role="status" className="mb-3 text-sm text-emerald-700">{submitNotices[assignment.id]}</p>}
                          {submitErrors[assignment.id] && <p role="alert" className="mb-3 text-sm text-red-700">{submitErrors[assignment.id]}</p>}
                          <form onSubmit={(event) => void submitAssignment(event, assignment)} className="space-y-4">
                            {assignment.assignment_type === 'quiz' ? (
                              <fieldset className="space-y-4">
                                <legend className="text-sm font-semibold text-slate-800">Multiple-choice quiz</legend>
                                {assignment.questions.map((question, questionIndex) => (
                                  <fieldset key={question.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                                    <legend className="px-1 text-sm font-medium">{questionIndex + 1}. {question.prompt}</legend>
                                    {question.options.map((option, optionIndex) => (
                                      <label key={optionIndex} className="flex items-start gap-2 text-sm text-slate-700">
                                        <input required type="radio" name={`question-${question.id}`} value={optionIndex} className="mt-1" />
                                        <span>{option}</span>
                                      </label>
                                    ))}
                                  </fieldset>
                                ))}
                              </fieldset>
                            ) : (
                              <>
                                <p className="text-sm text-slate-600">Accepted formats: {assignment.allowed_file_types.map((fileType) => fileType.toUpperCase()).join(', ')} · Maximum 20MB</p>
                                <label className="block text-sm font-medium text-slate-700">
                                  Finished work
                                  <input required type="file" accept={assignment.allowed_file_types.map((fileType) => `.${fileType}`).join(',')} name="file" className="mt-1.5 block w-full text-sm" />
                                </label>
                              </>
                            )}
                            <button type="submit" disabled={submitting[assignment.id]} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                              {submitting[assignment.id] ? 'Submitting…' : submission ? 'Resubmit work' : 'Submit work'}
                            </button>
                          </form>
                        </>
                      )}
                    </section>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {user?.role === 'student' && <Link href={`/courses/${assignment.course_id}#unit-${assignment.unit_id}`} className="text-sm font-semibold text-blue-700 hover:underline">Open unit →</Link>}
                    {user?.role === 'lecturer' && <Link href={`/lecturer/units/${assignment.offering_id}#assignments`} className="text-sm font-semibold text-blue-700 hover:underline">Manage assignment →</Link>}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-semibold">No assignments to show</p>
            <p className="mt-1 text-sm text-slate-500">{user?.role === 'student' ? 'Your lecturers have not published any assignments for your units.' : 'Create an assignment from one of your unit pages.'}</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
