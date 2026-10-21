'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ApiPage } from '@/types/portal';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';

const EMPTY_FILTERS: Record<string, string> = {};

export interface DirectoryColumn<T> {
  label: string;
  render: (item: T) => ReactNode;
}

interface DirectoryPageProps<T> {
  title: string;
  description: string;
  endpoint: string;
  searchPlaceholder: string;
  columns: DirectoryColumn<T>[];
  getKey: (item: T) => string | number;
  emptyMessage: string;
  refreshKey?: number;
  headerAction?: ReactNode;
  actionColumn?: DirectoryColumn<T>;
  filters?: Record<string, string>;
  clientSearch?: (item: T) => string;
}

export default function DirectoryPage<T>({
  title,
  description,
  endpoint,
  searchPlaceholder,
  columns,
  getKey,
  emptyMessage,
  refreshKey = 0,
  headerAction,
  actionColumn,
  filters = EMPTY_FILTERS,
  clientSearch,
}: DirectoryPageProps<T>) {
  const [page, setPage] = useState<ApiPage<T> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const visibleColumns = actionColumn ? [...columns, actionColumn] : columns;
  const serverSearch = clientSearch ? '' : search;

  const loadPage = useCallback(async (signal?: AbortSignal) => {
    try {
      const nextPage = await getApiPage<T>(
        endpoint,
        { ...filters, page: pageNumber, ...(serverSearch ? { search: serverSearch } : {}) },
        signal,
      );
      setPage(nextPage);
      setError(null);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint, filters, pageNumber, serverSearch]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadPage(controller.signal));
    return () => controller.abort();
  }, [loadPage, refreshKey, reloadKey]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPageNumber(1);
    setSearch(draftSearch.trim());
    setReloadKey((current) => current + 1);
  }

  const visibleResults = page?.results.filter((item) => (
    !clientSearch || clientSearch(item).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  )) ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CampusHub</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {headerAction}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor={`${title.toLowerCase().replace(/\s+/g, '-')}-search`} className="sr-only">
            Search {title.toLowerCase()}
          </label>
          <input
            id={`${title.toLowerCase().replace(/\s+/g, '-')}-search`}
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div role="alert" className="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center">
          <p>{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); void loadPage(); }} className="self-start font-semibold underline sm:self-auto">
            Try again
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {page && (
            <p className="text-sm text-slate-500">
              {clientSearch && search ? `${visibleResults.length} matching` : `${page.count} total`}
            </p>
          )}
        </div>
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500" role="status">Loading {title.toLowerCase()}…</p>
        ) : page && visibleResults.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {visibleColumns.map((column) => <th key={column.label} scope="col" className="px-5 py-3 font-semibold">{column.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleResults.map((item) => (
                    <tr key={getKey(item)} className="hover:bg-slate-50/70">
                      {visibleColumns.map((column) => <td key={column.label} className="px-5 py-4 align-middle">{column.render(item)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                disabled={!page.previous || loading}
                onClick={() => { setLoading(true); setPageNumber((current) => Math.max(1, current - 1)); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">Page {pageNumber}</span>
              <button
                type="button"
                disabled={!page.next || loading}
                onClick={() => { setLoading(true); setPageNumber((current) => current + 1); }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            {error ? 'Data could not be loaded.' : clientSearch && search ? 'No results match your search.' : emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}
