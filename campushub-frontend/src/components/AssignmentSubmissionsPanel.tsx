'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import type { AssignmentSubmission, UnitAssignment } from '@/types/portal';

interface SubmissionRow {
  student_id: number;
  student_name: string;
  admission_number: string | null;
  course_code?: string;
  course_title?: string;
  submission: AssignmentSubmission | null;
  answers: Record<string, number>;
}

interface ReviewData {
  assignment_title: string;
  max_points: number;
  assignment_type: 'file' | 'quiz';
  count: number;
  submitted_count: number;
  results: SubmissionRow[];
}

type StudentListFilter = 'submitted' | 'marked' | 'not-marked' | 'not-submitted' | 'enrolled';
const STUDENTS_PER_PAGE = 25;

export default function AssignmentSubmissionsPanel({ assignment }: { assignment: UnitAssignment }) {
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStudent, setSavingStudent] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [releaseGrade, setReleaseGrade] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [listFilter, setListFilter] = useState<StudentListFilter | null>(null);
  const [listPage, setListPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const loadSubmissions = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<ReviewData>(`/academics/assignments/${assignment.id}/submissions/`, { signal });
      if (signal?.aborted) return;
      setReview(response.data);
      setScores(Object.fromEntries(response.data.results
        .filter((row) => row.submission)
        .map((row) => [row.student_id, row.submission?.score ?? ''])));
      setFeedback(Object.fromEntries(response.data.results
        .filter((row) => row.submission)
        .map((row) => [row.student_id, row.submission?.feedback ?? ''])));
      setReleaseGrade(Object.fromEntries(response.data.results
        .filter((row) => row.submission)
        .map((row) => [row.student_id, row.submission?.grade_released ?? true])));
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [assignment.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadSubmissions(controller.signal));
    return () => controller.abort();
  }, [loadSubmissions]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function saveGrade(event: FormEvent<HTMLFormElement>, studentId: number, submission: AssignmentSubmission) {
    event.preventDefault();
    setSavingStudent(studentId);
    setError(null);
    setNotice(null);
    try {
      const response = await api.patch<{ submission: AssignmentSubmission }>(
        `/academics/submissions/${submission.id}/grade/`,
        { score: scores[studentId], feedback: feedback[studentId] ?? '', release: releaseGrade[studentId] ?? true },
      );
      setReview((current) => current && ({
        ...current,
        results: current.results.map((row) => row.student_id === studentId
          ? { ...row, submission: response.data.submission }
          : row),
      }));
      setNotice(`Mark saved for ${review?.results.find((row) => row.student_id === studentId)?.student_name ?? 'student'}.`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSavingStudent(null);
    }
  }

  async function previewSubmission(submission: AssignmentSubmission) {
    setError(null);
    try {
      const response = await api.get<Blob>(
        `/academics/submissions/${submission.id}/download/`,
        { responseType: 'blob' },
      );
      setPreview({
        url: URL.createObjectURL(response.data),
        fileName: submission.file_name ?? 'Submitted work',
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function downloadSubmission(submission: AssignmentSubmission) {
    try {
      const response = await api.get<Blob>(
        `/academics/submissions/${submission.id}/download/`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = submission.file_name ?? 'assignment-submission';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  const markedCount = review?.results.filter((row) => row.submission?.graded_at !== null && row.submission !== null).length ?? 0;
  const filteredRows = (review?.results ?? []).filter((row) => {
    if (listFilter === 'submitted' && !row.submission) return false;
    if (listFilter === 'marked' && (row.submission?.graded_at === null || !row.submission)) return false;
    if (listFilter === 'not-marked' && (!row.submission || row.submission.graded_at !== null)) return false;
    if (listFilter === 'not-submitted' && row.submission) return false;
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return row.student_name.toLowerCase().includes(query)
      || (row.admission_number ?? '').toLowerCase().includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / STUDENTS_PER_PAGE));
  const visibleRows = filteredRows.slice((listPage - 1) * STUDENTS_PER_PAGE, listPage * STUDENTS_PER_PAGE);

  function showStudentList(filter: StudentListFilter) {
    setListFilter(filter);
    setListPage(1);
    setSearch('');
    setSelectedStudentId(null);
  }

  return (
    <section aria-labelledby="assignment-submissions-heading" className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div>
        <h2 id="assignment-submissions-heading" className="text-xl font-semibold">Submissions</h2>
        <p className="mt-1 text-sm text-slate-600">Select a student to view submitted work and add a mark or feedback.</p>
      </div>
      {loading ? <p role="status" className="text-sm text-slate-500">Loading submissions…</p> : error && !review ? (
        <div><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => { setLoading(true); void loadSubmissions(); }} className="mt-2 text-sm font-semibold text-blue-700 underline">Try again</button></div>
      ) : review ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {([
              ['submitted', 'Submitted', review.submitted_count, 'bg-blue-50 text-blue-900', 'text-blue-700'],
              ['marked', 'Marked', markedCount, 'bg-emerald-50 text-emerald-900', 'text-emerald-700'],
              ['not-marked', 'Not marked', review.submitted_count - markedCount, 'bg-amber-50 text-amber-900', 'text-amber-700'],
              ['not-submitted', 'Not submitted', review.count - review.submitted_count, 'bg-red-50 text-red-900', 'text-red-700'],
              ['enrolled', 'Enrolled', review.count, 'bg-slate-50 text-slate-900', 'text-slate-600'],
            ] as const).map(([filter, label, count, cardColors, labelColor]) => (
              <button
                key={filter}
                type="button"
                aria-pressed={listFilter === filter}
                aria-controls="assignment-student-list"
                onClick={() => showStudentList(filter)}
                className={`rounded-lg px-3 py-2.5 text-left transition hover:ring-2 hover:ring-blue-300 ${cardColors} ${listFilter === filter ? 'ring-2 ring-blue-700' : ''}`}
              >
                <span className={`block text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</span>
                <span className="mt-0.5 block text-xl font-bold">{count}</span>
                {filter === 'marked' && <span className="block text-[11px]">of {review.submitted_count} submitted</span>}
              </button>
            ))}
          </div>
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {listFilter ? (
            <div id="assignment-student-list" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{listFilter === 'submitted' ? 'Submitted work' : listFilter === 'marked' ? 'Marked submissions' : listFilter === 'not-marked' ? 'Submitted, not marked' : listFilter === 'not-submitted' ? 'Students who have not submitted' : 'Enrolled students'}</h3>
                  <p className="mt-0.5 text-xs text-slate-600">{filteredRows.length} {filteredRows.length === 1 ? 'student' : 'students'} · showing {filteredRows.length ? (listPage - 1) * STUDENTS_PER_PAGE + 1 : 0}–{Math.min(listPage * STUDENTS_PER_PAGE, filteredRows.length)}</p>
                </div>
                <label className="w-full text-xs font-medium text-slate-700 sm:max-w-xs">Search by name or registration number<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setListPage(1); setSelectedStudentId(null); }} placeholder="e.g. 23/08181" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 sm:text-sm" /></label>
              </div>
              {filteredRows.length ? <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr><th scope="col" className="px-3 py-2">Student name</th><th scope="col" className="px-3 py-2">Registration number</th><th scope="col" className="px-3 py-2">Course</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2"><span className="sr-only">Action</span></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <tr key={row.student_id} className={selectedStudentId === row.student_id ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50'}>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{row.student_name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.admission_number ?? 'Not provided'}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.course_code ?? assignment.course_code} · {row.course_title ?? assignment.course_title}</td>
                        <td className="px-3 py-2.5">
                          {!row.submission ? <span className="text-xs font-medium text-red-700">Not submitted</span> : row.submission.graded_at !== null
                            ? <span className={`text-xs font-medium ${row.submission.grade_released === false ? 'text-amber-700' : 'text-emerald-700'}`}>{row.submission.grade_released === false ? 'Draft mark' : 'Marked'} · {row.submission.score} / {review.max_points}</span>
                            : <span className="text-xs font-medium text-amber-700">Not marked{row.submission.score !== null ? ` · auto score ${row.submission.score}` : ''}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {row.submission ? <button type="button" aria-expanded={selectedStudentId === row.student_id} onClick={() => setSelectedStudentId((current) => current === row.student_id ? null : row.student_id)} className="rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50">{selectedStudentId === row.student_id ? 'Close' : 'View'}</button> : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No students match this list.</p>}
              {selectedStudentId !== null && (() => {
                const row = visibleRows.find((student) => student.student_id === selectedStudentId);
                if (!row?.submission) return null;
                const submission = row.submission;
                const submittedOnTime = Date.parse(submission.submitted_at) <= Date.parse(assignment.due_at);
                return <section aria-label={`Submission details for ${row.student_name}`} className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h4 className="font-semibold text-slate-900">{row.student_name}</h4><p className="text-xs text-slate-600">{row.admission_number ?? 'Not provided'} · {row.course_code ?? assignment.course_code} · {row.course_title ?? assignment.course_title}</p></div>
                    <div className="text-right text-xs"><p className={submittedOnTime ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{submittedOnTime ? 'Submitted early / on time' : 'Submitted late'}</p><p className="text-slate-500">{new Date(submission.submitted_at).toLocaleString()}</p></div>
                  </div>
                  {submission.file_name && <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="max-w-full truncate text-slate-700">{submission.file_name}</span>
                    <button type="button" onClick={() => void previewSubmission(submission)} className="font-semibold text-blue-700 underline">View</button>
                    <button type="button" onClick={() => void downloadSubmission(submission)} className="font-semibold text-slate-700 underline">Download</button>
                  </div>}
                  {review.assignment_type === 'quiz' && <ol className="space-y-1 border-t border-slate-200 pt-2 text-sm text-slate-700">
                    {assignment.questions.map((question, index) => <li key={question.id}>{index + 1}. {question.prompt} — {question.options[row.answers[String(question.id)] ?? -1] ?? 'No answer'}</li>)}
                  </ol>}
                  <form onSubmit={(event) => void saveGrade(event, row.student_id, submission)} className="grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto] sm:items-end">
                    <label className="block text-xs font-medium text-slate-700">Mark / {review.max_points}<input required type="number" min="0" max={review.max_points} step="0.01" value={scores[row.student_id] ?? ''} onChange={(event) => setScores((current) => ({ ...current, [row.student_id]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label>
                    <label className="block text-xs font-medium text-slate-700">Feedback (optional)<textarea rows={2} maxLength={5000} value={feedback[row.student_id] ?? ''} onChange={(event) => setFeedback((current) => ({ ...current, [row.student_id]: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm" /></label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={releaseGrade[row.student_id] ?? true} onChange={(event) => setReleaseGrade((current) => ({ ...current, [row.student_id]: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-700" />Release to student</label>
                    <button type="submit" disabled={savingStudent === row.student_id} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{savingStudent === row.student_id ? 'Saving…' : submission.score === null ? 'Award mark' : 'Save mark'}</button>
                  </form>
                </section>;
              })()}
              {pageCount > 1 && <nav aria-label="Submission list pages" className="flex items-center justify-between border-t border-slate-100 pt-3">
                <button type="button" disabled={listPage === 1} onClick={() => setListPage((page) => page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
                <span className="text-sm text-slate-600">Page {listPage} of {pageCount}</span>
                <button type="button" disabled={listPage === pageCount} onClick={() => setListPage((page) => page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
              </nav>}
            </div>
          ) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Choose Submitted, Marked, Not marked, Not submitted, or Enrolled to open that student list.</p>}
        </>
      ) : null}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="presentation" onClick={() => setPreview(null)}>
          <section role="dialog" aria-modal="true" aria-label={`Preview ${preview.fileName}`} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3"><h3 className="truncate font-semibold">{preview.fileName}</h3><button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Close preview</button></header>
            {/\.(pdf|png|jpe?g|gif|webp)$/i.test(preview.fileName) ? <iframe title={`Preview of ${preview.fileName}`} src={preview.url} className="min-h-[70vh] w-full" /> : <div className="p-8 text-center"><p className="font-semibold">This file type cannot be previewed in the browser.</p><a href={preview.url} download={preview.fileName} className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Download file</a></div>}
          </section>
        </div>
      )}
    </section>
  );
}
