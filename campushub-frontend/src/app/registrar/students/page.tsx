'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import DirectoryPage from '@/components/DirectoryPage';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course } from '@/types/portal';

interface RegistrarStudent {
  id: number;
  first_name: string;
  last_name: string;
  admission_number: string | null;
  email: string;
  role: 'student';
}

interface StudentAccountForm {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  admission_number: string;
  phone_number: string;
  course_id: string;
}

const initialForm: StudentAccountForm = {
  first_name: '',
  last_name: '',
  email: '',
  username: '',
  admission_number: '',
  phone_number: '',
  course_id: '',
};

export default function RegistrarStudentsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'success' | 'warning'>('success');
  const [directoryRefresh, setDirectoryRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getApiPage<Course>('/academics/courses/', {}, controller.signal)
      .then((page) => setCourses(page.results.filter((course) => course.is_active)))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setCoursesError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCoursesLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post<{ welcome_email_status?: string }>('/users/', {
        ...form,
        course_id: Number(form.course_id),
        role: 'student',
        send_welcome_email: true,
      });
      if (data.welcome_email_status === 'sent' || data.welcome_email_status === 'queued') {
        setNotice(`Student account created. The initial sign-in email has been sent to ${form.email}.`);
        setNoticeKind('success');
      } else {
        setNotice(`Student account created, but email delivery was not confirmed for ${form.email}. Do not submit again; contact an administrator to check delivery and resend the invitation.`);
        setNoticeKind('warning');
      }
      setForm(initialForm);
      setConfirmed(false);
      setDirectoryRefresh((current) => current + 1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell roles={['registrar']}>
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link href="/registrar" className="text-sm font-semibold text-blue-700 hover:underline">← Registrar office</Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Registrar office</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Student accounts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Search active student records and register admitted students. Initial sign-in instructions are sent directly to the student’s verified email.</p>
          </div>
          <a href="#student-directory" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Browse student directory
          </a>
        </header>
        {notice && <p role="status" className={`rounded-lg border p-3 text-sm ${noticeKind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{notice}</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <form id="register-student-account" onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Register an admitted student</h2>
            <p className="mt-1 text-sm text-slate-600">Confirm the student’s admission details before creating their account.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">First name
              <input required autoComplete="given-name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-medium text-slate-700">Last name
              <input required autoComplete="family-name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-medium text-slate-700">Student email
              <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-medium text-slate-700">Username
              <input required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-medium text-slate-700">Admission number
              <input required maxLength={30} value={form.admission_number} onChange={(event) => setForm({ ...form, admission_number: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-medium text-slate-700">Phone (optional)
              <input type="tel" autoComplete="tel" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Admitted programme
              <select required value={form.course_id} onChange={(event) => setForm({ ...form, course_id: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                <option value="">Select a programme</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
              </select>
              {coursesError && <span role="alert" className="mt-1 block text-xs text-red-700">{coursesError}</span>}
              {!coursesError && !courses.length && <span className="mt-1 block text-xs text-slate-500">{coursesLoading ? 'Loading active programmes…' : 'No active programmes are available. Contact ICT support.'}</span>}
            </label>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950">
            <input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700" />
            <span>I confirm the student has been admitted and the email and admission number above are verified. Create the student account and send its initial sign-in email.</span>
          </label>
          <button type="submit" disabled={saving || !confirmed} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">
            {saving ? 'Creating account and sending email…' : 'Confirm admission and send login email'}
          </button>
        </form>
        <div id="student-directory">
          <DirectoryPage<RegistrarStudent>
            title="Student directory"
            description="Find active student accounts by name, admission number, or email. Account access changes remain restricted to authorized administrators."
            endpoint="/users/"
            searchPlaceholder="Search name, admission number, or email"
            filters={{ role: 'student' }}
            refreshKey={directoryRefresh}
            getKey={(student) => student.id}
            emptyMessage="No active student accounts match this search."
            columns={[
              {
                label: 'Student',
                render: (student) => <span className="font-semibold text-slate-900">{student.first_name} {student.last_name}</span>,
              },
              {
                label: 'Admission number',
                render: (student) => <span className="text-slate-700">{student.admission_number || 'Not assigned'}</span>,
              },
              {
                label: 'Email',
                render: (student) => <span className="break-all text-slate-600">{student.email}</span>,
              },
            ]}
          />
        </div>
      </section>
    </PortalShell>
  );
}
