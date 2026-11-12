'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AdminStats } from '@/types/portal';
import type { ApiPage } from '@/types/portal';
import { roleLabels } from '@/lib/role-access';
import type { CampusRole } from '@/types';

type MetricKey = keyof AdminStats;

interface AdminMetric {
  key: MetricKey;
  label: string;
  detail: string;
}

interface DirectoryEntry {
  id: number;
  name: string;
  subtitle: string;
  category: string;
  status: string;
}

interface FilterOption {
  id: number;
  name: string;
}

interface DirectoryFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

const adminMetrics: AdminMetric[] = [
  { key: 'active_users', label: 'Active users', detail: 'Active platform accounts' },
  { key: 'students', label: 'Students', detail: 'Active student accounts' },
  { key: 'lecturers', label: 'Lecturers', detail: 'Active lecturer accounts' },
  { key: 'placement_officers', label: 'Placement officers', detail: 'Active officer accounts' },
  { key: 'schools', label: 'Schools', detail: 'Academic schools' },
  { key: 'departments', label: 'Departments', detail: 'Academic departments' },
  { key: 'courses', label: 'Programmes', detail: 'Active academic programmes' },
  { key: 'units', label: 'Units', detail: 'Active shared units' },
  { key: 'active_enrollments', label: 'Active admissions', detail: 'Students assigned to programmes' },
  { key: 'placements', label: 'Placements', detail: 'Active opportunities' },
  { key: 'open_placements', label: 'Open placements', detail: 'Open opportunities with upcoming deadlines' },
  { key: 'applications', label: 'Applications', detail: 'Applications received' },
  { key: 'pending_applications', label: 'Pending applications', detail: 'Awaiting review' },
];

const campusRoles: CampusRole[] = [
  'student', 'lecturer', 'officer', 'admin', 'ict_admin', 'registrar',
  'finance', 'hod', 'examination', 'librarian', 'hostel',
];
const accountStatusOptions = [
  { value: 'active', label: 'Active accounts' },
  { value: 'inactive', label: 'Inactive accounts' },
  { value: 'all', label: 'All accounts' },
];
const applicationStatusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];
const enrollmentStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All statuses' },
];
const activeStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All statuses' },
];
const placementStatusOptions = [
  { value: 'active', label: 'All active placements' },
  { value: 'open', label: 'Open now' },
  { value: 'closed', label: 'Past deadline' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All placements' },
];
const PAGE_SIZE = 12;

function getDefaultFilters(metric: MetricKey): Record<string, string> {
  if (['active_users', 'students', 'lecturers', 'placement_officers'].includes(metric)) {
    return { account_status: 'active', ...(metric === 'active_users' ? { role: 'all' } : {}) };
  }
  if (metric === 'applications') return { status: 'all' };
  if (metric === 'pending_applications') return { status: 'pending' };
  if (metric === 'active_enrollments') return { status: 'active' };
  if (metric === 'placements') return { placement_status: 'active' };
  if (metric === 'open_placements') return { placement_status: 'open' };
  if (metric === 'schools') return { is_active: 'all' };
  if (['courses', 'units'].includes(metric)) return { is_active: 'active' };
  return {};
}

function getFilters(
  metric: MetricKey,
  departments: FilterOption[],
  schools: FilterOption[],
): DirectoryFilter[] {
  const departmentFilter: DirectoryFilter = {
    key: 'department_id',
    label: 'Department',
    options: [{ value: '', label: 'All departments' }, ...departments.map(({ id, name }) => ({ value: String(id), label: name }))],
  };
  if (metric === 'active_users') {
    return [
      { key: 'role', label: 'Role', options: [{ value: 'all', label: 'All roles' }, ...campusRoles.map((role) => ({ value: role, label: roleLabels[role] }))] },
      { key: 'account_status', label: 'Account status', options: accountStatusOptions },
    ];
  }
  if (['students', 'lecturers', 'placement_officers'].includes(metric)) {
    return [
      { key: 'department_id', label: 'Department', options: departmentFilter.options },
      { key: 'account_status', label: 'Account status', options: accountStatusOptions },
    ];
  }
  if (metric === 'departments') {
    return [{
      key: 'school_id',
      label: 'School',
      options: [{ value: '', label: 'All schools' }, ...schools.map(({ id, name }) => ({ value: String(id), label: name }))],
    }];
  }
  if (metric === 'courses' || metric === 'units') {
    return [
      departmentFilter,
      { key: 'is_active', label: 'Status', options: activeStatusOptions },
    ];
  }
  if (metric === 'schools') return [{ key: 'is_active', label: 'Status', options: activeStatusOptions }];
  if (metric === 'active_enrollments') {
    return [
      enrollmentStatusFilter,
      departmentFilter,
    ];
  }
  if (metric === 'applications' || metric === 'pending_applications') {
    return [{ key: 'status', label: 'Application status', options: applicationStatusOptions }];
  }
  if (metric === 'placements' || metric === 'open_placements') {
    return [{ key: 'placement_status', label: 'Placement status', options: placementStatusOptions }];
  }
  return [];
}

const enrollmentStatusFilter: DirectoryFilter = {
  key: 'status',
  label: 'Enrolment status',
  options: enrollmentStatusOptions,
};

export default function AdminCampusStats() {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<AdminMetric | null>(null);
  const [directoryPage, setDirectoryPage] = useState<ApiPage<DirectoryEntry> | null>(null);
  const [directoryPageNumber, setDirectoryPageNumber] = useState(1);
  const [directoryFilters, setDirectoryFilters] = useState<Record<string, string>>({});
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryReloadKey, setDirectoryReloadKey] = useState(0);
  const [departments, setDepartments] = useState<FilterOption[]>([]);
  const [schools, setSchools] = useState<FilterOption[]>([]);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const loadAdminStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get<AdminStats>('/admin/stats/', { signal });
      setAdminStats(data);
      setStatsError(null);
    } catch (error) {
      if (!signal?.aborted) setStatsError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setStatsLoading(false);
    }
  }, []);

  const closeDirectory = useCallback(() => {
    setSelectedMetric(null);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAdminStats(controller.signal));
    return () => controller.abort();
  }, [loadAdminStats]);

  useEffect(() => {
    if (!selectedMetric) return;
    const controller = new AbortController();
    const loadDirectory = async () => {
      setDirectoryLoading(true);
      setDirectoryError(null);
      try {
        const page = await getApiPage<DirectoryEntry>(
          `/admin/stats/directory/${selectedMetric.key}/`,
          { ...directoryFilters, page: directoryPageNumber, page_size: PAGE_SIZE, ...(search ? { search } : {}) },
          controller.signal,
        );
        if (!controller.signal.aborted) setDirectoryPage(page);
      } catch (error) {
        if (!controller.signal.aborted) setDirectoryError(getApiErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setDirectoryLoading(false);
      }
    };
    void loadDirectory();
    return () => controller.abort();
  }, [directoryFilters, directoryPageNumber, directoryReloadKey, search, selectedMetric]);

  useEffect(() => {
    if (!selectedMetric) return;
    const needsDepartments = ['students', 'lecturers', 'placement_officers', 'courses', 'units', 'active_enrollments'].includes(selectedMetric.key);
    const needsSchools = selectedMetric.key === 'departments';
    if (!needsDepartments && !needsSchools) return;

    const controller = new AbortController();
    const loadOptions = async () => {
      try {
        const [departmentPage, schoolPage] = await Promise.all([
          needsDepartments ? getApiPage<FilterOption>('/academics/departments/', {}, controller.signal) : Promise.resolve(null),
          needsSchools ? getApiPage<FilterOption>('/academics/schools/', {}, controller.signal) : Promise.resolve(null),
        ]);
        if (!controller.signal.aborted) {
          if (departmentPage) setDepartments(departmentPage.results);
          if (schoolPage) setSchools(schoolPage.results);
        }
      } catch (error) {
        if (!controller.signal.aborted) setDirectoryError(getApiErrorMessage(error));
      }
    };
    void loadOptions();
    return () => controller.abort();
  }, [selectedMetric]);

  useEffect(() => {
    if (!selectedMetric) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDirectory();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeDirectory, selectedMetric]);

  function openDirectory(metric: AdminMetric, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setDirectoryPage(null);
    setDirectoryPageNumber(1);
    setDirectoryFilters(getDefaultFilters(metric.key));
    setSearchDraft('');
    setSearch('');
    setDirectoryError(null);
    setSelectedMetric(metric);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDirectoryPageNumber(1);
    setSearch(searchDraft.trim());
  }

  const visibleFilters = selectedMetric ? getFilters(selectedMetric.key, departments, schools) : [];

  return (
    <section aria-labelledby="admin-stats-heading" className="space-y-6">
      <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-lg shadow-slate-900/10 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Campus operations</p>
        <h1 id="admin-stats-heading" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Campus stats</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">A clear view of institutional activity. Select any measure to explore its records.</p>
        <p className="mt-5 text-xs font-medium text-slate-300">Current platform totals · Select a measure to view its directory</p>
      </header>

      {statsError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{statsError}</p>
          <button type="button" onClick={() => { setStatsLoading(true); void loadAdminStats(); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold hover:bg-red-100">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {adminMetrics.map((metric, index) => (
          <button
            ref={index === 0 ? openerRef : undefined}
            key={metric.key}
            type="button"
            disabled={statsLoading || !adminStats}
            onClick={(event) => openDirectory(metric, event.currentTarget)}
            aria-haspopup="dialog"
            className="group min-h-32 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-70 sm:p-5"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-600">{metric.label}</span>
              <span aria-hidden="true" className="rounded-lg bg-slate-50 p-1.5 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10h11m-4-4 4 4-4 4" />
                </svg>
              </span>
            </span>
            <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-950">
              {statsLoading ? <span className="text-sm font-medium text-slate-400">Loading…</span> : adminStats?.[metric.key] ?? '—'}
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{metric.detail}</span>
          </button>
        ))}
      </div>

      {selectedMetric && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDirectory(); }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stats-directory-title"
            className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-slate-50 shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Campus directory</p>
                <h2 id="stats-directory-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{selectedMetric.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedMetric.detail}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDirectory}
                aria-label="Close directory"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </header>

            <div className="overflow-y-auto p-4 sm:p-6">
              <form onSubmit={submitSearch} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(12rem,1fr)_auto] sm:p-5">
                <label className="min-w-0">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Search this directory</span>
                  <input
                    autoFocus
                    type="search"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder={`Search ${selectedMetric.label.toLowerCase()} by name or details`}
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <button type="submit" className="self-end rounded-xl bg-blue-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">
                  Search
                </button>
                {visibleFilters.length > 0 && (
                  <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 sm:col-span-2">
                    {visibleFilters.map((filter) => (
                      <label key={filter.key} className="min-w-40 flex-1 text-xs font-semibold text-slate-600">
                        {filter.label}
                        <select
                          value={directoryFilters[filter.key] ?? filter.options[0]?.value ?? ''}
                          onChange={(event) => {
                            setDirectoryFilters((current) => ({ ...current, [filter.key]: event.target.value }));
                            setDirectoryPageNumber(1);
                          }}
                          className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </form>

              {directoryError && (
                <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p>{directoryError}</p>
                  <button type="button" onClick={() => setDirectoryReloadKey((current) => current + 1)} className="font-semibold underline">Retry</button>
                </div>
              )}

              <section aria-label={`${selectedMetric.label} results`} aria-live="polite" className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <h3 className="text-sm font-bold text-slate-900">{search ? 'Matching records' : 'Records'}</h3>
                  <p className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {directoryPage ? `${directoryPage.count.toLocaleString()} total` : 'Loading'}
                  </p>
                </div>
                {directoryLoading ? (
                  <p role="status" className="p-12 text-center text-sm text-slate-500">Loading directory…</p>
                ) : directoryPage?.results.length ? (
                  <>
                    <ul className="divide-y divide-slate-100">
                      {directoryPage.results.map((entry) => (
                        <li key={entry.id} className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{entry.name}</p>
                            <p className="mt-1 truncate text-sm text-slate-500">{entry.subtitle}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{entry.category}</span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${/active|open|accepted/i.test(entry.status) ? 'bg-emerald-50 text-emerald-800' : /pending|shortlisted/i.test(entry.status) ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                              {entry.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        disabled={!directoryPage.previous || directoryLoading}
                        onClick={() => setDirectoryPageNumber((current) => Math.max(1, current - 1))}
                        className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-medium text-slate-500">
                        Page {directoryPageNumber} of {Math.max(1, Math.ceil(directoryPage.count / PAGE_SIZE))}
                      </span>
                      <button
                        type="button"
                        disabled={!directoryPage.next || directoryLoading}
                        onClick={() => setDirectoryPageNumber((current) => current + 1)}
                        className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="p-12 text-center text-sm text-slate-500">
                    {search ? 'No records match your search and filters.' : 'No records match these filters.'}
                  </p>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
