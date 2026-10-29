'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AssignmentSubmissionsPanel from '@/components/AssignmentSubmissionsPanel';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import type { UnitAssignment } from '@/types/portal';

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export default function LecturerAssignmentPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p role="status" className="text-sm text-slate-500">Loading assignment…</p>
      </main>
    }>
      <LecturerAssignmentContent />
    </Suspense>
  );
}

function LecturerAssignmentContent() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<UnitAssignment | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [isPublished, setIsPublished] = useState(true);
  const [editing, setEditing] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAssignment = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<UnitAssignment>(`/academics/assignments/${assignmentId}/`, { signal });
      if (signal?.aborted) return;
      setAssignment(response.data);
      setTitle(response.data.title);
      setInstructions(response.data.instructions);
      setDueAt(toLocalDateTime(response.data.due_at));
      setMaxPoints(String(response.data.max_points));
      setIsPublished(response.data.is_published);
      setAttachmentFile(null);
      setRemoveAttachment(false);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAssignment(controller.signal));
    return () => controller.abort();
  }, [loadAssignment]);

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dueAt || Number(maxPoints) < 1 || Number(maxPoints) > 1000) {
      setError('Enter a valid due date and a mark between 1 and 1000.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = new FormData();
      payload.append('title', title.trim());
      payload.append('instructions', instructions.trim());
      payload.append('due_at', new Date(dueAt).toISOString());
      payload.append('max_points', String(Number(maxPoints)));
      payload.append('is_published', String(isPublished));
      if (attachmentFile) payload.append('attachment', attachmentFile);
      if (removeAttachment) payload.append('remove_attachment', 'true');
      const response = await api.patch<UnitAssignment>(`/academics/assignments/${assignmentId}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAssignment(response.data);
      setEditing(false);
      setAttachmentFile(null);
      setRemoveAttachment(false);
      setNotice('Assignment changes saved.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment() {
    if (!assignment || !window.confirm(`Delete "${assignment.title}"? This will permanently remove the assignment and its submissions.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/academics/assignments/${assignmentId}/`);
      router.replace('/assignments');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setDeleting(false);
    }
  }

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-6">
        <Link href="/assignments" className="text-sm font-semibold text-blue-700 hover:underline">← Back to assignments</Link>
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading assignment…</p>
        ) : error && !assignment ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p role="alert" className="text-sm text-red-800">{error}</p>
            <button type="button" onClick={() => { setLoading(true); void loadAssignment(); }} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button>
          </div>
        ) : assignment ? (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{assignment.unit_code} · {assignment.course_code}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
                <button type="button" onClick={() => setEditing((current) => !current)} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">{editing ? 'Cancel editing' : 'Edit assignment'}</button>
              </div>
              <p className="mt-2 text-sm text-slate-600">{assignment.unit_title} · {assignment.course_title}</p>
              <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment type</dt><dd className="mt-1 text-sm font-medium">{assignment.assignment_type === 'quiz' ? 'Multiple-choice quiz' : 'File submission'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maximum points</dt><dd className="mt-1 text-sm font-medium">{assignment.max_points}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due</dt><dd className="mt-1 text-sm font-medium">{new Date(assignment.due_at).toLocaleString()}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt><dd className="mt-1 text-sm font-medium">{assignment.is_published ? 'Published' : 'Draft'}</dd></div>
              </dl>
            </header>

            {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            {editing && <form onSubmit={(event) => void saveAssignment(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div><h2 className="font-semibold">Edit assignment</h2><p className="mt-1 text-sm text-slate-600">Update its details or attach a PDF/Word document for students.</p></div>
                <label className="block text-sm font-medium text-slate-700">Title<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Instructions (optional when a document is attached)<textarea rows={7} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Assignment document (PDF, DOC, or DOCX; max 10MB)<input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setAttachmentFile(event.target.files?.[0] ?? null); if (event.target.files?.[0]) setRemoveAttachment(false); }} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-800" /></label>
                {assignment.attachment_name && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={removeAttachment} onChange={(event) => { setRemoveAttachment(event.target.checked); if (event.target.checked) setAttachmentFile(null); }} />Remove current document ({assignment.attachment_name})</label>}
                <label className="block text-sm font-medium text-slate-700">Due date and time<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Maximum points<input required type="number" min="1" max="1000" value={maxPoints} onChange={(event) => setMaxPoints(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} className="mt-0.5" />
                  <span><span className="block font-semibold">Published</span><span className="mt-0.5 block text-xs text-slate-500">When unpublished, students cannot view or submit this assignment.</span></span>
                </label>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => void deleteAssignment()} disabled={deleting} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete assignment'}</button>
              </form>}

            <AssignmentSubmissionsPanel assignment={assignment} />
          </>
        ) : null}
      </section>
    </PortalShell>
  );
}
