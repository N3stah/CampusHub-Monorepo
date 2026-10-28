'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import PortalShell from '@/components/PortalShell';
import api from '@/lib/api';
import { downloadBlob, getDownloadFilename } from '@/lib/application-files';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type {
  AssignmentSubmission,
  ClassSession,
  CourseAnnouncement,
  CourseResource,
  CourseRosterEntry,
  UnitAssignment,
  UnitGroupSet,
} from '@/types/portal';

interface UnitOffering {
  id: number;
  offering_id: number;
  unit_id: number;
  unit_code: string;
  unit_title: string;
  unit_description: string;
  credits: number;
  course_id: number;
  course_code: string;
  course_title: string;
  department_name: string;
  school_name: string;
}

interface AssignmentQuestionDraft {
  prompt: string;
  options: string[];
  correct_option: number;
}

function createQuestionDraft(): AssignmentQuestionDraft {
  return { prompt: '', options: ['', '', '', ''], correct_option: 0 };
}

function countdown(dueAt: string) {
  const difference = new Date(dueAt).getTime() - Date.now();
  if (difference <= 0) return 'Past due';
  const days = Math.floor(difference / 86_400_000);
  const hours = Math.floor((difference % 86_400_000) / 3_600_000);
  if (days) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m remaining`;
}

interface AssignmentReviewRow {
  student_id: number;
  student_name: string;
  admission_number: string | null;
  submission: AssignmentSubmission | null;
  answers: Record<string, number>;
}

interface AssignmentReviewData {
  assignment_title: string;
  max_points: number;
  assignment_type: 'file' | 'quiz';
  count: number;
  submitted_count: number;
  results: AssignmentReviewRow[];
}

function AssignmentSubmissionsPanel({ assignment }: { assignment: UnitAssignment }) {
  const [review, setReview] = useState<AssignmentReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStudent, setSavingStudent] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});

  const loadSubmissions = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get<AssignmentReviewData>(
        `/academics/assignments/${assignment.id}/submissions/`,
        { signal },
      );
      if (signal?.aborted) return;
      setReview(response.data);
      setScores(Object.fromEntries(response.data.results
        .filter((row) => row.submission)
        .map((row) => [row.student_id, row.submission?.score ?? ''])));
      setFeedback(Object.fromEntries(response.data.results
        .filter((row) => row.submission)
        .map((row) => [row.student_id, row.submission?.feedback ?? ''])));
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

  async function downloadStudentSubmission(submission: AssignmentSubmission) {
    try {
      const response = await api.get<Blob>(
        `/academics/submissions/${submission.id}/download/`,
        { responseType: 'blob' },
      );
      downloadBlob(
        response.data,
        getDownloadFilename(response.headers['content-disposition'], submission.file_name ?? 'assignment-submission'),
      );
    } catch (downloadError) {
      setGradeError(getApiErrorMessage(downloadError));
    }
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>, studentId: number, submission: AssignmentSubmission) {
    event.preventDefault();
    setSavingStudent(studentId);
    setGradeError(null);
    setNotice(null);
    try {
      const response = await api.patch<{ submission: AssignmentSubmission }>(
        `/academics/submissions/${submission.id}/grade/`,
        { score: scores[studentId], feedback: feedback[studentId] ?? '' },
      );
      setReview((current) => current && ({
        ...current,
        results: current.results.map((row) => row.student_id === studentId
          ? { ...row, submission: response.data.submission }
          : row),
      }));
      setNotice(`Mark saved for ${review?.results.find((row) => row.student_id === studentId)?.student_name ?? 'student'}.`);
    } catch (gradeRequestError) {
      setGradeError(getApiErrorMessage(gradeRequestError));
    } finally {
      setSavingStudent(null);
    }
  }

  return (
    <section id={`assignment-submissions-${assignment.id}`} aria-label={`Submissions for ${assignment.title}`} className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5">
      {loading ? (
        <p role="status" className="text-sm text-slate-500">Loading student submissions…</p>
      ) : error ? (
        <div><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => { setLoading(true); void loadSubmissions(); }} className="mt-2 text-sm font-semibold text-blue-700 underline">Try again</button></div>
      ) : review ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Student submissions</h3>
              <p className="mt-1 text-sm text-slate-600">{review.submitted_count} of {review.count} students submitted · marks out of {review.max_points}</p>
            </div>
          </div>
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {gradeError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{gradeError}</p>}
          {review.results.length ? (
            <ul className="space-y-3">
              {review.results.map((row) => (
                <li key={row.student_id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{row.student_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.admission_number ?? 'No admission number'}</p>
                    </div>
                    {row.submission ? (
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-semibold text-emerald-700">Submitted {new Date(row.submission.submitted_at).toLocaleString()}</p>
                        {row.submission.graded_at && <p className="mt-1 text-xs text-slate-500">Marked {new Date(row.submission.graded_at).toLocaleString()}</p>}
                      </div>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Not submitted</span>
                    )}
                  </div>
                  {row.submission && (
                    <>
                      {row.submission.file_name && (
                        <button type="button" onClick={() => void downloadStudentSubmission(row.submission!)} className="mt-3 text-sm font-semibold text-blue-700 underline">
                          Download {row.submission.file_name}
                        </button>
                      )}
                      {review.assignment_type === 'quiz' && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">Quiz answers · Score: {row.submission.score ?? 'Not scored'} / {review.max_points}</p>
                          <ol className="mt-2 space-y-2">
                            {assignment.questions.map((question, index) => {
                              const selectedOption = row.answers[String(question.id)];
                              return (
                                <li key={question.id} className="text-sm text-slate-600">
                                  <span className="font-medium">{index + 1}. {question.prompt}</span>
                                  <p className="mt-0.5">Student answer: {question.options[selectedOption] ?? 'No answer'}</p>
                                  {question.correct_option !== undefined && selectedOption !== question.correct_option && (
                                    <p className="text-emerald-700">Correct answer: {question.options[question.correct_option]}</p>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}
                      <form onSubmit={(event) => void saveGrade(event, row.student_id, row.submission!)} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
                        <label className="block text-sm font-medium text-slate-700">
                          Mark / {review.max_points}
                          <input
                            required
                            type="number"
                            min="0"
                            max={review.max_points}
                            step="0.01"
                            value={scores[row.student_id] ?? ''}
                            onChange={(event) => setScores((current) => ({ ...current, [row.student_id]: event.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Feedback (optional)
                          <textarea
                            rows={2}
                            maxLength={5000}
                            value={feedback[row.student_id] ?? ''}
                            onChange={(event) => setFeedback((current) => ({ ...current, [row.student_id]: event.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                          />
                        </label>
                        <button type="submit" disabled={savingStudent === row.student_id} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                          {savingStudent === row.student_id ? 'Saving…' : row.submission.score === null ? 'Award mark' : 'Save mark'}
                        </button>
                      </form>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No active students are enrolled in this unit.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function LecturerUnitPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p role="status" className="text-sm text-slate-500">Loading unit…</p>
      </main>
    }>
      <LecturerUnitContent />
    </Suspense>
  );
}

function LecturerUnitContent() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const [unit, setUnit] = useState<UnitOffering | null>(null);
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [announcements, setAnnouncements] = useState<CourseAnnouncement[]>([]);
  const [assignments, setAssignments] = useState<UnitAssignment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [roster, setRoster] = useState<CourseRosterEntry[]>([]);
  const [groups, setGroups] = useState<UnitGroupSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceCategory, setResourceCategory] = useState<'notes' | 'topic'>('notes');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentInstructions, setAssignmentInstructions] = useState('');
  const [assignmentDueAt, setAssignmentDueAt] = useState('');
  const [assignmentPoints, setAssignmentPoints] = useState('100');
  const [assignmentType, setAssignmentType] = useState<'file' | 'quiz'>('file');
  const [assignmentFileTypes, setAssignmentFileTypes] = useState<string[]>(['pdf']);
  const [assignmentQuestions, setAssignmentQuestions] = useState<AssignmentQuestionDraft[]>([createQuestionDraft()]);
  const [groupScheme, setGroupScheme] = useState<'letters' | 'numbers'>('letters');
  const [studentsPerGroup, setStudentsPerGroup] = useState('5');
  const [rosterSearch, setRosterSearch] = useState('');
  const [openSubmissionsFor, setOpenSubmissionsFor] = useState<number | null>(null);
  const [downloadingGradebook, setDownloadingGradebook] = useState(false);
  const [gradebookError, setGradebookError] = useState<string | null>(null);

  const loadUnit = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [
        unitResponse,
        resourcePage,
        announcementPage,
        assignmentPage,
        sessionPage,
        rosterPage,
        groupResponse,
      ] = await Promise.all([
        api.get<UnitOffering>(`/academics/offerings/${offeringId}/`, { signal }),
        getApiPage<CourseResource>(`/resources/offerings/${offeringId}/resources/`, {}, signal),
        getApiPage<CourseAnnouncement>(`/resources/offerings/${offeringId}/announcements/`, {}, signal),
        getApiPage<UnitAssignment>(`/academics/offerings/${offeringId}/assignments/`, {}, signal),
        getApiPage<ClassSession>(`/academics/offerings/${offeringId}/sessions/`, {}, signal),
        getApiPage<CourseRosterEntry>(`/academics/offerings/${offeringId}/roster/`, {}, signal),
        api.get<UnitGroupSet | null>(`/academics/offerings/${offeringId}/groups/`, { signal }),
      ]);
      if (signal?.aborted) return;
      setUnit(unitResponse.data);
      setResources(resourcePage.results);
      setAnnouncements(announcementPage.results);
      setAssignments(assignmentPage.results);
      setSessions(sessionPage.results);
      setRoster(rosterPage.results);
      setGroups(groupResponse.data);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadUnit(controller.signal));
    return () => controller.abort();
  }, [loadUnit]);

  async function uploadResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resourceTitle.trim() || !resourceFile) {
      setFormError('Enter a title and select a learning material file.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const payload = new FormData();
      payload.append('title', resourceTitle.trim());
      payload.append('description', resourceDescription.trim());
      payload.append('category', resourceCategory);
      payload.append('file', resourceFile);
      await api.post(`/resources/offerings/${offeringId}/resources/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResourceTitle('');
      setResourceDescription('');
      setResourceFile(null);
      event.currentTarget.reset();
      setNotice(resourceCategory === 'notes' ? 'Notes uploaded.' : 'Topic material uploaded.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function postAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await api.post(`/resources/offerings/${offeringId}/announcements/`, {
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
      });
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setNotice('Announcement sent to students in this unit.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assignmentType === 'file' && !assignmentFileTypes.length) {
      setFormError('Choose at least one accepted file format.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      await api.post(`/academics/offerings/${offeringId}/assignments/`, {
        title: assignmentTitle.trim(),
        instructions: assignmentInstructions.trim(),
        assignment_type: assignmentType,
        allowed_file_types: assignmentType === 'file' ? assignmentFileTypes : [],
        questions: assignmentType === 'quiz'
          ? assignmentQuestions.map((question) => ({
            ...question,
            prompt: question.prompt.trim(),
            options: question.options.map((option) => option.trim()),
          }))
          : [],
        due_at: new Date(assignmentDueAt).toISOString(),
        max_points: Number(assignmentPoints),
      });
      setAssignmentTitle('');
      setAssignmentInstructions('');
      setAssignmentDueAt('');
      setAssignmentType('file');
      setAssignmentFileTypes(['pdf']);
      setAssignmentQuestions([createQuestionDraft()]);
      setNotice('Assignment published for students in this unit.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function generateGroups(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const response = await api.post<UnitGroupSet>(`/academics/offerings/${offeringId}/groups/`, {
        naming_scheme: groupScheme,
        students_per_group: Number(studentsPerGroup),
      });
      setGroups(response.data);
      setNotice(`Created ${response.data.groups.length} groups for ${roster.length} enrolled students.`);
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteResource(resource: CourseResource) {
    if (!window.confirm(`Delete "${resource.title}"?`)) return;
    setFormError(null);
    try {
      await api.delete(`/resources/offerings/${offeringId}/resources/${resource.id}/`);
      setNotice('Learning material deleted.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    }
  }

  async function deleteAnnouncement(announcement: CourseAnnouncement) {
    if (!window.confirm(`Delete announcement "${announcement.title}"?`)) return;
    setFormError(null);
    try {
      await api.delete(`/resources/offerings/${offeringId}/announcements/${announcement.id}/`);
      setNotice('Announcement deleted.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    }
  }

  async function deleteAssignment(assignment: UnitAssignment) {
    if (!window.confirm(`Delete assignment "${assignment.title}"?`)) return;
    setFormError(null);
    try {
      await api.delete(`/academics/assignments/${assignment.id}/`);
      setNotice('Assignment deleted.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    }
  }

  async function downloadGradebook() {
    setDownloadingGradebook(true);
    setGradebookError(null);
    try {
      const response = await api.get<Blob>(
        `/academics/offerings/${offeringId}/grades.csv`,
        { responseType: 'blob' },
      );
      downloadBlob(
        response.data,
        getDownloadFilename(response.headers['content-disposition'], `${unit?.unit_code ?? 'unit'}-marks.csv`),
      );
    } catch (requestError) {
      setGradebookError(getApiErrorMessage(requestError));
    } finally {
      setDownloadingGradebook(false);
    }
  }

  async function deleteSession(session: ClassSession) {
    if (!window.confirm(`Remove the ${session.day_name} ${session.start_time} class?`)) return;
    setFormError(null);
    try {
      await api.delete(`/academics/sessions/${session.id}/`);
      setNotice('Class removed from the calendar.');
      await loadUnit();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    }
  }

  const filteredRoster = roster.filter((student) => (
    `${student.student_name} ${student.admission_number ?? ''}`.toLowerCase().includes(rosterSearch.trim().toLowerCase())
  ));

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-6">
        <Link href="/lecturer/units" className="text-sm font-semibold text-blue-700 hover:underline">← Back to units</Link>
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading unit…</p>
        ) : error || !unit ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p role="alert" className="text-sm text-red-800">{error ?? 'Unit not found.'}</p>
            <button type="button" onClick={() => void loadUnit()} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button>
          </div>
        ) : (
          <>
            <header id="overview" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">{unit.unit_code} · {unit.credits} credits</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">{unit.unit_title}</h1>
              {unit.unit_description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{unit.unit_description}</p>}
              <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course overview</dt><dd className="mt-1 text-sm font-medium">{unit.course_code} · {unit.course_title}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</dt><dd className="mt-1 text-sm font-medium">{unit.department_name}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrolled students</dt><dd className="mt-1 text-sm font-medium">{roster.length}</dd></div>
              </dl>
              <nav aria-label="Unit sections" className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {[
                  ['Students', 'students'],
                  ['Materials and notes', 'materials'],
                  ['Announcements', 'announcements'],
                  ['Assignments', 'assignments'],
                  ['Schedule', 'schedule'],
                  ['Groups', 'groups'],
                ].map(([label, id]) => <a key={id} href={`#${id}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">{label}</a>)}
              </nav>
            </header>

            {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
            {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}

            <section id="students" aria-labelledby="unit-roster-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div><h2 id="unit-roster-heading" className="font-semibold">Students in this unit</h2><p className="mt-1 text-xs text-slate-500">Active students enrolled in {unit.course_code}.</p></div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{roster.length}</span>
              </div>
              {roster.length > 0 && <div className="border-b border-slate-100 p-4"><label className="block text-sm font-medium text-slate-700">Search by name or admission number<input type="search" value={rosterSearch} onChange={(event) => setRosterSearch(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 sm:max-w-sm" /></label></div>}
              {filteredRoster.length ? (
                <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredRoster.map((student) => <li key={student.student_id} className="rounded-xl border border-slate-200 p-3"><p className="font-medium">{student.student_name}</p><p className="mt-1 text-xs text-slate-500">{student.admission_number ?? 'No admission number'}</p></li>)}
                </ul>
              ) : <p className="px-5 py-8 text-center text-sm text-slate-500">{roster.length ? 'No students match your search.' : 'No active students are enrolled in this unit yet.'}</p>}
            </section>

            <section id="materials" aria-labelledby="unit-materials-heading" className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4"><h2 id="unit-materials-heading" className="font-semibold">Learning materials and notes</h2><p className="mt-1 text-xs text-slate-500">Upload study notes or topic resources for this unit.</p></div>
                {resources.length ? <ul className="divide-y divide-slate-100">{resources.map((resource) => <li key={resource.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{resource.category ?? 'Learning material'}</p><p className="mt-1 font-medium">{resource.title}</p>{resource.description && <p className="mt-1 text-sm text-slate-600">{resource.description}</p>}</div><div className="flex gap-2">{resource.file_url && <a href={resource.file_url} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Open</a>}<button type="button" onClick={() => void deleteResource(resource)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Delete</button></div></li>)}</ul> : <p className="p-6 text-sm text-slate-500">No materials have been uploaded for this unit.</p>}
              </div>
              <form onSubmit={uploadResource} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Add learning material</h3>
                <label className="block text-sm font-medium text-slate-700">Type<select value={resourceCategory} onChange={(event) => setResourceCategory(event.target.value as 'notes' | 'topic')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="notes">Notes</option><option value="topic">Topic</option></select></label>
                <label className="block text-sm font-medium text-slate-700">Title<input required maxLength={200} value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Description<textarea rows={3} value={resourceDescription} onChange={(event) => setResourceDescription(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">File<input required type="file" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg" onChange={(event) => setResourceFile(event.target.files?.[0] ?? null)} className="mt-1.5 w-full text-sm" /></label>
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Uploading…' : 'Upload material'}</button>
              </form>
            </section>

            <section id="announcements" aria-labelledby="unit-announcements-heading" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4"><h2 id="unit-announcements-heading" className="font-semibold">Unit announcements</h2><p className="mt-1 text-xs text-slate-500">Only students enrolled in this unit&#39;s course receive these updates.</p></div>
                {announcements.length ? <ul className="divide-y divide-slate-100">{announcements.map((announcement) => <li key={announcement.id} className="flex items-start justify-between gap-3 p-5"><div><h3 className="font-medium">{announcement.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{announcement.body}</p><time className="mt-2 block text-xs text-slate-400">{new Date(announcement.created_at).toLocaleString()}</time></div><button type="button" onClick={() => void deleteAnnouncement(announcement)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Delete</button></li>)}</ul> : <p className="p-6 text-sm text-slate-500">No announcements for this unit yet.</p>}
              </div>
              <form onSubmit={postAnnouncement} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Post an announcement</h3>
                <label className="block text-sm font-medium text-slate-700">Title<input required maxLength={200} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Message<textarea required rows={5} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Posting…' : 'Post to this unit'}</button>
              </form>
            </section>

            <section id="assignments" aria-labelledby="unit-assignments-heading" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div><h2 id="unit-assignments-heading" className="font-semibold">Assignments and submissions</h2><p className="mt-1 text-xs text-slate-500">Review student work, award marks, and provide feedback.</p></div>
                  <button type="button" onClick={() => void downloadGradebook()} disabled={downloadingGradebook || !assignments.length} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                    {downloadingGradebook ? 'Preparing marks…' : 'Download unit marks'}
                  </button>
                </div>
                {gradebookError && <p role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">{gradebookError}</p>}
                {assignments.length ? (
                  <ul className="divide-y divide-slate-100">
                    {assignments.map((assignment) => {
                      const submissionsOpen = openSubmissionsFor === assignment.id;
                      return (
                        <li key={assignment.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                            <div>
                              <h3 className="font-medium">{assignment.title}</h3>
                              <p className="mt-1 text-sm text-slate-600">{assignment.assignment_type === 'quiz' ? 'Multiple-choice quiz' : `File submission · ${assignment.allowed_file_types.map((fileType) => fileType.toUpperCase()).join(', ')}`} · {assignment.max_points} points · Due {new Date(assignment.due_at).toLocaleString()}</p>
                              <p className="mt-1 text-xs font-semibold text-amber-800">{countdown(assignment.due_at)}</p>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{assignment.instructions}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                aria-expanded={submissionsOpen}
                                onClick={() => setOpenSubmissionsFor(submissionsOpen ? null : assignment.id)}
                                className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                {submissionsOpen ? 'Hide submissions' : 'Review submissions'}
                              </button>
                              <button type="button" onClick={() => void deleteAssignment(assignment)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Delete</button>
                            </div>
                          </div>
                          {submissionsOpen && <AssignmentSubmissionsPanel assignment={assignment} />}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="p-6 text-sm text-slate-500">No assignments have been published for this unit.</p>}
              </div>
              <form onSubmit={createAssignment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Create assignment</h3>
                <label className="block text-sm font-medium text-slate-700">Title<input required maxLength={200} value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Submission type<select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as 'file' | 'quiz')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="file">File upload</option><option value="quiz">Multiple-choice quiz</option></select></label>
                <label className="block text-sm font-medium text-slate-700">Instructions<textarea required rows={4} value={assignmentInstructions} onChange={(event) => setAssignmentInstructions(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Due date and time<input required type="datetime-local" value={assignmentDueAt} onChange={(event) => setAssignmentDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Maximum points<input required type="number" min="1" max="1000" value={assignmentPoints} onChange={(event) => setAssignmentPoints(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                {assignmentType === 'file' ? (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-700">Accepted file formats</legend>
                    <div className="flex flex-wrap gap-3">
                      {['pdf', 'doc', 'docx', 'ppt', 'pptx'].map((fileType) => (
                        <label key={fileType} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={assignmentFileTypes.includes(fileType)}
                            onChange={(event) => setAssignmentFileTypes((current) => event.target.checked
                              ? [...current, fileType]
                              : current.filter((value) => value !== fileType))}
                          />
                          {fileType.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <fieldset className="space-y-4">
                    <legend className="text-sm font-medium text-slate-700">Quiz questions</legend>
                    {assignmentQuestions.map((question, questionIndex) => (
                      <fieldset key={questionIndex} className="space-y-3 rounded-lg border border-slate-200 p-3">
                        <legend className="px-1 text-sm font-semibold">Question {questionIndex + 1}</legend>
                        <label className="block text-sm font-medium text-slate-700">
                          Question
                          <textarea
                            required
                            maxLength={2000}
                            rows={2}
                            value={question.prompt}
                            onChange={(event) => setAssignmentQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                          />
                        </label>
                        {question.options.map((option, optionIndex) => (
                          <label key={optionIndex} className="block text-sm font-medium text-slate-700">
                            Option {optionIndex + 1}
                            <input
                              required
                              maxLength={500}
                              value={option}
                              onChange={(event) => setAssignmentQuestions((current) => current.map((item, index) => {
                                if (index !== questionIndex) return item;
                                const options = [...item.options];
                                options[optionIndex] = event.target.value;
                                return { ...item, options };
                              }))}
                              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                            />
                          </label>
                        ))}
                        <label className="block text-sm font-medium text-slate-700">
                          Correct answer
                          <select
                            value={question.correct_option}
                            onChange={(event) => setAssignmentQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, correct_option: Number(event.target.value) } : item))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                          >
                            {question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}
                          </select>
                        </label>
                        {assignmentQuestions.length > 1 && <button type="button" onClick={() => setAssignmentQuestions((current) => current.filter((_, index) => index !== questionIndex))} className="text-sm font-semibold text-red-700 hover:underline">Remove question</button>}
                      </fieldset>
                    ))}
                    <button type="button" disabled={assignmentQuestions.length >= 100} onClick={() => setAssignmentQuestions((current) => [...current, createQuestionDraft()])} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Add question</button>
                  </fieldset>
                )}
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Creating…' : 'Publish assignment'}</button>
              </form>
            </section>

            <section id="schedule" aria-labelledby="unit-schedule-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 id="unit-schedule-heading" className="font-semibold">Class schedule</h2><p className="mt-1 text-xs text-slate-500">Weekly sessions are also shown on enrolled students&#39; calendars.</p></div><Link href="/dashboard" className="text-sm font-semibold text-blue-700 hover:underline">Add a class from overview →</Link></div>
              {sessions.length ? <ul className="divide-y divide-slate-100">{sessions.map((session) => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-medium">{session.day_name}, {session.start_time}–{session.end_time}</p><p className="mt-1 text-xs text-slate-500">{session.location || 'Location not set'} · {session.starts_on} to {session.ends_on}</p></div><button type="button" onClick={() => void deleteSession(session)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Remove</button></li>)}</ul> : <p className="p-6 text-sm text-slate-500">No classes have been scheduled for this unit.</p>}
            </section>

            <section id="groups" aria-labelledby="unit-groups-heading" className="grid gap-5 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
              <form onSubmit={generateGroups} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div><h2 id="unit-groups-heading" className="font-semibold">Student groups</h2><p className="mt-1 text-xs text-slate-500">Create balanced groups from all active students enrolled in this unit.</p></div>
                <label className="block text-sm font-medium text-slate-700">Group labels<select value={groupScheme} onChange={(event) => setGroupScheme(event.target.value as 'letters' | 'numbers')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="letters">Letters (A–G)</option><option value="numbers">Numbers (1–10)</option></select></label>
                <label className="block text-sm font-medium text-slate-700">Students per group<input required type="number" min="1" max="100" value={studentsPerGroup} onChange={(event) => setStudentsPerGroup(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                <p className="text-xs leading-5 text-slate-500">Groups are shuffled automatically. Generating again replaces the existing group set for this unit.</p>
                <button type="submit" disabled={saving || roster.length === 0} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? 'Creating groups…' : 'Auto-create groups'}</button>
                {roster.length === 0 && <p className="text-xs text-slate-500">There are no enrolled students to group.</p>}
              </form>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Current group set</h3>
                {groups?.groups.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{groups.groups.map((group) => <section key={group.id} className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold">Group {group.name} <span className="text-xs font-normal text-slate-500">· {group.students.length} students</span></h4><ul className="mt-2 space-y-1 text-sm text-slate-600">{group.students.map((student) => <li key={student.id}>{student.name}</li>)}</ul></section>)}</div> : <p className="mt-2 text-sm text-slate-500">No groups have been generated for this unit.</p>}
              </div>
            </section>
          </>
        )}
      </section>
    </PortalShell>
  );
}
