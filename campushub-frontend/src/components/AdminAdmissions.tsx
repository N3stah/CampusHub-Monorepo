'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, DirectoryUser } from '@/types/portal';

interface ProgrammeEnrollment {
  id: number;
  student_id: number;
  admission_number: string | null;
  student_name: string;
  student_email: string;
  school_name: string | null;
  department_name: string | null;
  course_id: number;
  course_code: string;
  course_title: string;
  status: 'active' | 'dropped' | 'completed';
  enrolled_at: string;
}

export default function AdminAdmissions() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<ProgrammeEnrollment[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [admissionInput, setAdmissionInput] = useState('');
  const [studentMatches, setStudentMatches] = useState<DirectoryUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<DirectoryUser | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | number | null>(null);
  const [previous, setPrevious] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<number | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      getApiPage<Course>('/academics/courses/', {}, signal),
      getApiPage<ProgrammeEnrollment>('/academics/admin/enrollments/', {
        search,
        course_id: filterCourseId,
        page,
        page_size: 25,
      }, signal),
    ]);
    if (signal?.aborted) return;
    const errors: string[] = [];
    if (results[0].status === 'fulfilled') setCourses(results[0].value.results);
    else errors.push(`Programmes: ${getApiErrorMessage(results[0].reason)}`);
    if (results[1].status === 'fulfilled') {
      setEnrollments(results[1].value.results);
      setCount(results[1].value.count);
      setNext(results[1].value.next);
      setPrevious(results[1].value.previous);
    } else errors.push(`Enrolments: ${getApiErrorMessage(results[1].reason)}`);
    setError(errors.length ? errors.join(' ') : null);
    setLoading(false);
  }, [filterCourseId, page, search]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadData(controller.signal));
    return () => controller.abort();
  }, [loadData]);

  async function findStudent() {
    const admissionNumber = admissionInput.trim();
    if (!admissionNumber) return;
    setLookupLoading(true);
    setError(null);
    setSelectedStudent(null);
    try {
      const result = await getApiPage<DirectoryUser>('/users/', {
        role: 'student',
        search: admissionNumber,
      });
      setStudentMatches(result.results.filter((student) => (
        student.admission_number?.toLocaleLowerCase() === admissionNumber.toLocaleLowerCase()
      )));
      if (!result.results.some((student) => student.admission_number?.toLocaleLowerCase() === admissionNumber.toLocaleLowerCase())) {
        setError('No student has that exact admission number. Check the number or create the student account first.');
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLookupLoading(false);
    }
  }

  async function assignProgramme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent?.admission_number || !selectedCourseId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.post('/academics/admin/enrollments/', {
        admission_number: selectedStudent.admission_number,
        course_id: Number(selectedCourseId),
      });
      setNotice(`${selectedStudent.first_name} ${selectedStudent.last_name} assigned to the selected programme.`);
      setAdmissionInput('');
      setStudentMatches([]);
      setSelectedStudent(null);
      setPage(1);
      await loadData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(enrollment: ProgrammeEnrollment, status: ProgrammeEnrollment['status']) {
    setBusyEnrollmentId(enrollment.id);
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/academics/admin/enrollments/${enrollment.id}/`, { status });
      setNotice(`${enrollment.student_name}'s enrolment is now ${status}.`);
      await loadData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusyEnrollmentId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administration</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Academic operations</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Programme admissions</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Assign students to an academic programme by their unique admission number. Update enrolment status without deleting the student’s academic record.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <form onSubmit={assignProgramme} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">Assign a student to a programme</h2>
          <p className="mt-1 text-sm text-slate-500">First find the student by admission number, then select their admitted programme.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)_auto] lg:items-end">
          <label className="text-sm font-medium text-slate-700">
            Admission number
            <div className="mt-1 flex gap-2">
              <input required value={admissionInput} onChange={(event) => { setAdmissionInput(event.target.value); setSelectedStudent(null); setStudentMatches([]); }} placeholder="e.g. 23/08181" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2" />
              <button type="button" disabled={lookupLoading || !admissionInput.trim()} onClick={() => void findStudent()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                {lookupLoading ? 'Finding…' : 'Find'}
              </button>
            </div>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Admitted programme
            <select required value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="">Choose programme</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
            </select>
          </label>
          <button type="submit" disabled={saving || !selectedStudent || !selectedCourseId} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? 'Assigning…' : 'Assign programme'}
          </button>
        </div>
        {!!studentMatches.length && (
          <fieldset className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-blue-800">Confirm student</legend>
            {studentMatches.map((student) => (
              <label key={student.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-white">
                <input type="radio" name="admitted-student" checked={selectedStudent?.id === student.id} onChange={() => setSelectedStudent(student)} className="mt-1 text-blue-700" />
                <span className="text-sm">
                  <span className="block font-semibold text-slate-900">{student.first_name} {student.last_name} · {student.admission_number}</span>
                  <span className="block text-xs text-slate-600">{student.school_name ?? 'School not set'} / {student.department_name ?? 'Department not set'} · {student.email}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </form>

      <section aria-labelledby="enrolment-register-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
          <div>
            <h2 id="enrolment-register-heading" className="font-semibold">Programme enrolment register</h2>
            {!loading && <p className="mt-1 text-xs text-slate-500">{count} record{count === 1 ? '' : 's'}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="enrolment-search">Search by admission number or name</label>
            <input id="enrolment-search" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search admission number or student" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <label className="sr-only" htmlFor="enrolment-programme-filter">Filter by programme</label>
            <select id="enrolment-programme-filter" value={filterCourseId} onChange={(event) => { setPage(1); setFilterCourseId(event.target.value); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">All programmes</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
            </select>
          </div>
        </div>
        {loading ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading enrolment records…</p> : enrollments.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">School / department</th><th className="px-5 py-3">Programme</th><th className="px-5 py-3">Enrolled</th><th className="px-5 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td className="px-5 py-3"><span className="block font-semibold">{enrollment.student_name}</span><span className="text-xs text-slate-500">{enrollment.admission_number || 'No admission number'} · {enrollment.student_email}</span></td>
                      <td className="px-5 py-3 text-slate-600">{enrollment.school_name ?? '—'} / {enrollment.department_name ?? '—'}</td>
                      <td className="px-5 py-3"><span className="block font-semibold">{enrollment.course_code}</span><span className="text-xs text-slate-500">{enrollment.course_title}</span></td>
                      <td className="px-5 py-3 text-slate-600">{new Date(enrollment.enrolled_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <label className="sr-only" htmlFor={`enrolment-status-${enrollment.id}`}>Update status for {enrollment.student_name}</label>
                        <select id={`enrolment-status-${enrollment.id}`} disabled={busyEnrollmentId === enrollment.id} value={enrollment.status} onChange={(event) => void updateStatus(enrollment, event.target.value as ProgrammeEnrollment['status'])} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs capitalize">
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="dropped">Withdrawn</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <button type="button" disabled={!previous || loading} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-40">Previous</button>
              <span className="text-xs text-slate-500">Page {page}</span>
              <button type="button" disabled={!next || loading} onClick={() => { setLoading(true); setPage((current) => current + 1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-40">Next</button>
            </div>
          </>
        ) : <p role="status" className="p-8 text-center text-sm text-slate-500">No programme enrolments found for these filters.</p>}
      </section>
    </section>
  );
}
