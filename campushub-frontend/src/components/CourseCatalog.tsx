'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { Course, Enrollment } from '@/types/portal';

interface Department {
  id: number;
  name: string;
  code: string;
}

export default function CourseCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    try {
      const [coursePage, departmentPage, enrollmentPage] = await Promise.all([
        getApiPage<Course>('/academics/courses/', departmentId ? { department: departmentId } : {}, signal),
        getApiPage<Department>('/academics/departments/', {}, signal),
        getApiPage<Enrollment>('/academics/enrollments/', {}, signal),
      ]);
      setCourses(coursePage.results);
      setDepartments(departmentPage.results);
      setEnrollments(enrollmentPage.results);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadCatalog(controller.signal));
    return () => controller.abort();
  }, [loadCatalog]);

  async function enroll(course: Course) {
    setSubmittingId(course.id);
    setError(null);
    setNotice(null);
    try {
      await api.post('/academics/enrollments/', { course_id: course.id });
      setNotice(`You are now enrolled in ${course.code}.`);
      await loadCatalog();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmittingId(null);
    }
  }

  function enrollmentFor(courseId: number) {
    return enrollments.find((enrollment) => enrollment.course_id === courseId);
  }

  const filteredCourses = courses.filter((course) => (
    `${course.code} ${course.title} ${course.description ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
  const visibleCourses = filteredCourses.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

  return (
    <section aria-labelledby="course-catalog-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <h2 id="course-catalog-heading" className="font-semibold">Course catalog</h2>
          <p className="mt-1 text-xs text-slate-500">Explore active courses and enroll in a course.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          <span className="sr-only">Filter courses by department</span>
          <select
            value={departmentId}
            onChange={(event) => { setLoading(true); setPageNumber(1); setDepartmentId(event.target.value); }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.code} — {department.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <label htmlFor="course-catalog-search" className="sr-only">Search course catalog</label>
        <input
          id="course-catalog-search"
          type="search"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }}
          placeholder="Search course code, title, or description"
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:max-w-md"
        />
      </div>

      {notice && <p role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && (
        <div className="flex flex-col justify-between gap-2 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800 sm:flex-row sm:items-center">
          <p role="alert">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); void loadCatalog(); }} className="self-start font-semibold underline sm:self-auto">Try again</button>
        </div>
      )}

      {loading ? (
        <p role="status" className="p-8 text-center text-sm text-slate-500">Loading course catalog…</p>
      ) : visibleCourses.length ? (
        <>
          <ul className="divide-y divide-slate-100">
          {visibleCourses.map((course) => {
            const enrollment = enrollmentFor(course.id);
            return (
              <li key={course.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{course.code}</p>
                  <h3 className="mt-1 font-semibold text-slate-900">{course.title}</h3>
                  {course.description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{course.description}</p>}
                  <p className="mt-1 text-xs text-slate-500">{course.credits} credits</p>
                </div>
                {enrollment?.status === 'active' ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Enrolled</span>
                ) : enrollment ? (
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold capitalize text-slate-600">{enrollment.status}</span>
                ) : (
                  <button
                    type="button"
                    disabled={submittingId !== null}
                    onClick={() => void enroll(course)}
                    className="shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingId === course.id ? 'Enrolling…' : 'Enroll'}
                  </button>
                )}
              </li>
            );
          })}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              disabled={pageNumber === 1}
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {pageNumber} of {pageCount} · {filteredCourses.length} courses</span>
            <button
              type="button"
              disabled={pageNumber >= pageCount}
              onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">
          {search ? 'No courses match your search.' : 'No active courses found for this department.'}
        </p>
      )}
    </section>
  );
}
