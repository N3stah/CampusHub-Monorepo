'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';

interface QuestionDraft {
  prompt: string;
  options: string[];
  correct_option: number;
}

export default function NewAssignmentPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p role="status" className="text-sm text-slate-500">Loading assignment form…</p>
      </main>
    }>
      <NewAssignmentContent />
    </Suspense>
  );
}

function NewAssignmentContent() {
  const params = useParams<{ offeringId: string }>();
  const router = useRouter();
  const offeringId = params.offeringId;
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [assignmentType, setAssignmentType] = useState<'file' | 'quiz'>('file');
  const [fileTypes, setFileTypes] = useState(['pdf']);
  const [dueAt, setDueAt] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ prompt: '', options: ['', '', '', ''], correct_option: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = {
        title: title.trim(),
        instructions: instructions.trim(),
        assignment_type: assignmentType,
        allowed_file_types: assignmentType === 'file' ? fileTypes : [],
        questions: assignmentType === 'quiz' ? questions.map((question) => ({
          prompt: question.prompt.trim(),
          options: question.options.map((option) => option.trim()),
          correct_option: question.correct_option,
        })) : [],
        due_at: new Date(dueAt).toISOString(),
        max_points: Number(maxPoints),
        is_published: true,
      };
      if (attachment && assignmentType === 'file') {
        const payload = new FormData();
        Object.entries(data).forEach(([key, value]) => payload.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value)));
        payload.append('attachment', attachment);
        await api.post(`/academics/offerings/${offeringId}/assignments/`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(`/academics/offerings/${offeringId}/assignments/`, data);
      }
      router.push('/assignments');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell roles={['lecturer']}>
      <section className="mx-auto max-w-3xl space-y-5">
        <Link href="/assignments" className="text-sm font-semibold text-blue-700 hover:underline">← Back to assignments</Link>
        <header><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Create assessment</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Add assignment</h1></header>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <form onSubmit={(event) => void createAssignment(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">Title<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="block text-sm font-medium text-slate-700">Submission type<select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as 'file' | 'quiz')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="file">File upload</option><option value="quiz">Multiple-choice quiz</option></select></label>
          <label className="block text-sm font-medium text-slate-700">Instructions<textarea required={assignmentType === 'quiz'} rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          {assignmentType === 'file' && <label className="block text-sm font-medium text-slate-700">Assignment document (optional)<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Due date and time<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="block text-sm font-medium text-slate-700">Maximum points<input required type="number" min="1" max="1000" value={maxPoints} onChange={(event) => setMaxPoints(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          </div>
          {assignmentType === 'file' ? (
            <fieldset className="space-y-2"><legend className="text-sm font-medium text-slate-700">Accepted file formats</legend><div className="flex flex-wrap gap-3">{['pdf', 'doc', 'docx', 'ppt', 'pptx'].map((fileType) => <label key={fileType} className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={fileTypes.includes(fileType)} onChange={(event) => setFileTypes((current) => event.target.checked ? [...current, fileType] : current.filter((value) => value !== fileType))} />{fileType.toUpperCase()}</label>)}</div></fieldset>
          ) : (
            <div className="space-y-4">{questions.map((question, questionIndex) => <fieldset key={questionIndex} className="space-y-3 rounded-lg border border-slate-200 p-3"><legend className="px-1 font-semibold">Question {questionIndex + 1}</legend><label className="block text-sm font-medium">Question<textarea required rows={2} value={question.prompt} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>{question.options.map((option, optionIndex) => <label key={optionIndex} className="block text-sm font-medium">Option {optionIndex + 1}<input required value={option} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((value, optionPosition) => optionPosition === optionIndex ? event.target.value : value) } : item))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>)}<label className="block text-sm font-medium">Correct answer<select value={question.correct_option} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, correct_option: Number(event.target.value) } : item))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5">{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}</select></label></fieldset>)}<button type="button" onClick={() => setQuestions((current) => [...current, { prompt: '', options: ['', '', '', ''], correct_option: 0 }])} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700">Add question</button></div>
          )}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Creating…' : 'Publish assignment'}</button>
        </form>
      </section>
    </PortalShell>
  );
}
