'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';

export interface CrudRecord {
  id: number | string;
  [key: string]: unknown;
}

export interface CrudLookup {
  endpoint: string;
  params?: Record<string, string | number>;
  labelFields: string[];
  searchParam?: string;
}

export interface CrudField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'date' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  lookup?: CrudLookup;
  defaultValue?: string | (() => string);
  readOnly?: boolean;
  hidden?: boolean;
}

export interface CrudFilter {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface CrudRowAction {
  label: string;
  endpointSuffix: string;
  confirmation: string;
  payload?: Record<string, string | number | boolean>;
  hideWhen?: { field: string; value: string };
}

interface ApiCrudWorkspaceProps {
  title: string;
  description: string;
  endpoint: string;
  fields: CrudField[];
  displayFields: string[];
  displayLabels?: Record<string, string>;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  deleteLabel?: string;
  deleteSuccessLabel?: string;
  deleteConfirmation?: string;
  filters?: CrudFilter[];
  sortableFields?: { value: string; label: string }[];
  baseParams?: Record<string, string | number>;
  rowActions?: CrudRowAction[];
}

const EMPTY_PARAMS: Record<string, string | number> = {};

function fieldValue(record: CrudRecord, name: string): string {
  const value = record[name];
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function lookupLabel(record: CrudRecord, fields: string[]): string {
  const label = fields.map((field) => displayValue(record[field])).filter((value) => value !== '—').join(' · ');
  return `${label || `Record ${record.id}`} (#${record.id})`;
}

export default function ApiCrudWorkspace({
  title,
  description,
  endpoint,
  fields,
  displayFields,
  displayLabels = {},
  allowCreate = true,
  allowEdit = true,
  allowDelete = true,
  deleteLabel = 'Delete',
  deleteSuccessLabel = 'deleted',
  deleteConfirmation = 'Delete this record?',
  filters = [],
  sortableFields = [],
  baseParams = EMPTY_PARAMS,
  rowActions = [],
}: ApiCrudWorkspaceProps) {
  const [records, setRecords] = useState<CrudRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [actionId, setActionId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | number | null>(null);
  const [previous, setPrevious] = useState<string | number | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [ordering, setOrdering] = useState('');
  const [editing, setEditing] = useState<CrudRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [lookupOptions, setLookupOptions] = useState<Record<string, CrudRecord[]>>({});
  const [lookupQueries, setLookupQueries] = useState<Record<string, string>>({});
  const [lookupLoading, setLookupLoading] = useState<Record<string, boolean>>({});

  const requestParams = useMemo(() => ({
    page,
    page_size: 25,
    ...(query ? { search: query } : {}),
    ...baseParams,
    ...Object.fromEntries(Object.entries(filterValues).filter(([, value]) => value)),
    ...(ordering ? { ordering } : {}),
  }), [baseParams, filterValues, ordering, page, query]);

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await getApiPage<CrudRecord>(endpoint, requestParams, signal);
      setRecords(result.results);
      setCount(result.count);
      setNext(result.next);
      setPrevious(result.previous);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint, requestParams]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadRecords(controller.signal));
    return () => controller.abort();
  }, [loadRecords]);

  const loadLookupOptions = useCallback(async (field: CrudField, signal?: AbortSignal) => {
    if (!field.lookup) return;
    setLookupLoading((current) => ({ ...current, [field.name]: true }));
    try {
      const result = await getApiPage<CrudRecord>(
        field.lookup.endpoint,
        { ...(field.lookup.params ?? {}), page_size: 100 },
        signal,
      );
      if (!signal?.aborted) setLookupOptions((current) => ({ ...current, [field.name]: result.results }));
    } catch (requestError) {
      if (!signal?.aborted) setFormError(`${field.label}: ${getApiErrorMessage(requestError)}`);
    } finally {
      if (!signal?.aborted) setLookupLoading((current) => ({ ...current, [field.name]: false }));
    }
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      for (const field of fields) {
        if (field.lookup && !lookupOptions[field.name]) void loadLookupOptions(field, controller.signal);
      }
    });
    return () => controller.abort();
  }, [fields, formOpen, loadLookupOptions, lookupOptions]);

  useEffect(() => {
    if (!formOpen) return;
    const controllers: AbortController[] = [];
    const timers: number[] = [];
    for (const field of fields) {
      const lookup = field.lookup;
      const search = lookupQueries[field.name]?.trim();
      if (!lookup || !search) continue;
      const controller = new AbortController();
      controllers.push(controller);
      timers.push(window.setTimeout(() => {
        setLookupLoading((current) => ({ ...current, [field.name]: true }));
        void getApiPage<CrudRecord>(
          lookup.endpoint,
          { ...(lookup.params ?? {}), [lookup.searchParam ?? 'search']: search, page_size: 100 },
          controller.signal,
        ).then((result) => {
          if (!controller.signal.aborted) setLookupOptions((current) => ({ ...current, [field.name]: result.results }));
        }).catch((requestError: unknown) => {
          if (!controller.signal.aborted) setFormError(`${field.label}: ${getApiErrorMessage(requestError)}`);
        }).finally(() => {
          if (!controller.signal.aborted) setLookupLoading((current) => ({ ...current, [field.name]: false }));
        });
      }, 250));
    }
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      controllers.forEach((controller) => controller.abort());
    };
  }, [fields, formOpen, lookupQueries]);

  function openCreate() {
    setEditing(null);
    setForm(Object.fromEntries(fields.map((field) => [
      field.name,
      typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue ?? '',
    ])));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(record: CrudRecord) {
    setEditing(record);
    setForm(Object.fromEntries(fields.map((field) => [field.name, fieldValue(record, field.name)])));
    setFormError(null);
    setFormOpen(true);
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload: Record<string, string | number | null> = {};
    for (const field of fields) {
      const value = form[field.name]?.trim() ?? '';
      if (!value && !field.required) {
        payload[field.name] = null;
      } else if (field.type === 'number') {
        payload[field.name] = Number(value);
      } else {
        payload[field.name] = value;
      }
    }

    try {
      if (editing) {
        await api.patch(`${endpoint}${editing.id}/`, payload);
        setNotice(`${title} record updated.`);
      } else {
        await api.post(endpoint, payload);
        setNotice(`${title} record created.`);
      }
      setEditing(null);
      setFormOpen(false);
      await loadRecords();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(record: CrudRecord) {
    if (!window.confirm(deleteConfirmation)) return;
    setDeletingId(record.id);
    setError(null);
    try {
      await api.delete(`${endpoint}${record.id}/`);
      setNotice(`${title} record ${deleteSuccessLabel}.`);
      await loadRecords();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  async function runRowAction(record: CrudRecord, action: CrudRowAction) {
    if (!window.confirm(action.confirmation)) return;
    setActionId(record.id);
    setError(null);
    try {
      await api.post(`${endpoint}${record.id}/${action.endpointSuffix}`, action.payload ?? {});
      setNotice(`${title} record updated.`);
      await loadRecords();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setActionId(null);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }

  function updateFilter(name: string, value: string) {
    setPage(1);
    setFilterValues((current) => ({ ...current, [name]: value }));
  }

  function updateLookupSearch(fieldName: string, value: string) {
    setLookupQueries((current) => ({ ...current, [fieldName]: value }));
    if (!value.trim()) {
      setLookupOptions((current) => {
        const remaining = { ...current };
        delete remaining[fieldName];
        return remaining;
      });
    }
  }

  const pageCount = Math.max(1, Math.ceil(count / 25));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {allowCreate && (
          <button type="button" onClick={openCreate} className="min-h-11 shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
            Add {title.toLocaleLowerCase().replace(/s$/, '')}
          </button>
        )}
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => void loadRecords()} className="min-h-10 font-semibold underline">Retry</button></div>}

      <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto_auto]">
        <form onSubmit={submitSearch} className="flex gap-2">
          <label className="sr-only" htmlFor={`${endpoint}-search`}>Search {title}</label>
          <input id={`${endpoint}-search`} value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder={`Search ${title.toLocaleLowerCase()}`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <button type="submit" className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Search</button>
        </form>
        {filters.map((filter) => (
          <label key={filter.name} className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">{filter.label}</span>
            <select value={filterValues[filter.name] ?? ''} onChange={(event) => updateFilter(filter.name, event.target.value)} className="min-h-11 min-w-32 rounded-lg border border-slate-300 bg-white px-3">
              <option value="">All</option>
              {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
        {sortableFields.length > 0 && (
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">Sort</span>
            <select value={ordering} onChange={(event) => { setPage(1); setOrdering(event.target.value); }} className="min-h-11 min-w-36 rounded-lg border border-slate-300 bg-white px-3">
              <option value="">Default</option>
              {sortableFields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{count} total records</span>
        <span>Page {page} of {pageCount}</span>
      </div>
      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-slate-500">Loading {title.toLocaleLowerCase()}…</p>
      ) : records.length ? (
        <>
          <ul className="divide-y divide-slate-100 sm:hidden">
            {records.map((record) => (
              <li key={record.id} className="space-y-3 py-4">
                {displayFields.map((fieldName) => (
                  <div key={fieldName} className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{displayLabels[fieldName] ?? fields.find((field) => field.name === fieldName)?.label ?? fieldName.replaceAll('_', ' ')}</span>
                    <span className="break-all text-right text-sm text-slate-700">{displayValue(record[fieldName])}</span>
                  </div>
                ))}
                {(allowEdit || allowDelete || rowActions.length > 0) && (
                  <div className="flex justify-end gap-2 pt-1">
                    {allowEdit && <button type="button" onClick={() => openEdit(record)} className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>}
                    {allowDelete && <button type="button" disabled={deletingId === record.id} onClick={() => void removeRecord(record)} className="min-h-10 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingId === record.id ? 'Working…' : deleteLabel}</button>}
                    {rowActions.filter((action) => !action.hideWhen || fieldValue(record, action.hideWhen.field) !== action.hideWhen.value).map((action) => (
                      <button key={action.label} type="button" disabled={actionId === record.id} onClick={() => void runRowAction(record, action)} className="min-h-10 rounded-md border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                        {actionId === record.id ? 'Working…' : action.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {displayFields.map((fieldName) => <th key={fieldName} scope="col" className="px-4 py-3">{displayLabels[fieldName] ?? fields.find((field) => field.name === fieldName)?.label ?? fieldName.replaceAll('_', ' ')}</th>)}
                  {(allowEdit || allowDelete || rowActions.length > 0) && <th scope="col" className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    {displayFields.map((fieldName) => <td key={fieldName} className="px-4 py-3 text-slate-700">{displayValue(record[fieldName])}</td>)}
                    {(allowEdit || allowDelete || rowActions.length > 0) && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {allowEdit && <button type="button" onClick={() => openEdit(record)} className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>}
                          {allowDelete && <button type="button" disabled={deletingId === record.id} onClick={() => void removeRecord(record)} className="min-h-10 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingId === record.id ? 'Working…' : deleteLabel}</button>}
                          {rowActions.filter((action) => !action.hideWhen || fieldValue(record, action.hideWhen.field) !== action.hideWhen.value).map((action) => (
                            <button key={action.label} type="button" disabled={actionId === record.id} onClick={() => void runRowAction(record, action)} className="min-h-10 rounded-md border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                              {actionId === record.id ? 'Working…' : action.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(previous || next) && (
            <nav aria-label={`${title} pages`} className="flex items-center justify-between border-t border-slate-100 pt-3">
              <button type="button" disabled={!previous || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <span className="text-sm text-slate-600">Page {page} of {pageCount}</span>
              <button type="button" disabled={!next || loading} onClick={() => setPage((current) => current + 1)} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </nav>
          )}
        </>
      ) : error ? (
        <p role="status" className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Records could not be loaded. Use Retry after the connection is available.
        </p>
      ) : (
        <p role="status" className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {query ? 'No records match your search. Try another term or clear your filters.' : `No ${title.toLocaleLowerCase()} found.`}
        </p>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby={`${endpoint}-dialog-title`} className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id={`${endpoint}-dialog-title`} className="text-xl font-bold text-slate-900">{editing ? `Edit ${title.toLocaleLowerCase().replace(/s$/, '')}` : `Add ${title.toLocaleLowerCase().replace(/s$/, '')}`}</h3>
                <p className="mt-1 text-sm text-slate-500">Changes will be saved to the connected CampusHub API.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => { setEditing(null); setFormOpen(false); }} aria-label="Close dialog" className="min-h-10 min-w-10 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            {formError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
            <form onSubmit={saveRecord} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => {
                  if (field.hidden) return <input key={field.name} type="hidden" name={field.name} value={form[field.name] ?? ''} />;
                  const lookupSearch = lookupQueries[field.name] ?? '';
                  const options = (lookupOptions[field.name] ?? []).filter((option) => (
                    !lookupSearch || lookupLabel(option, field.lookup?.labelFields ?? []).toLowerCase().includes(lookupSearch.toLowerCase())
                  ));
                  return (
                    <label key={field.name} className={`block text-sm font-medium text-slate-700 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                      {field.label}
                      {field.lookup ? (
                        <span className="mt-1.5 block space-y-2">
                          <input value={lookupSearch} onChange={(event) => updateLookupSearch(field.name, event.target.value)} placeholder={`Search ${field.label.toLocaleLowerCase()}`} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                          <select required={field.required} value={form[field.name] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                            <option value="">{lookupLoading[field.name] ? 'Loading options…' : `Select ${field.label.toLocaleLowerCase()}`}</option>
                            {options.map((option) => <option key={option.id} value={option.id}>{lookupLabel(option, field.lookup?.labelFields ?? [])}</option>)}
                          </select>
                          {!lookupLoading[field.name] && !options.length && <span className="block text-xs font-normal text-amber-800">No matches found. Check the directory or lookup endpoint.</span>}
                        </span>
                      ) : field.options ? (
                        <select required={field.required} value={form[field.name] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                          <option value="">Select {field.label.toLocaleLowerCase()}</option>
                          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea required={field.required} value={form[field.name] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} placeholder={field.placeholder} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
                      ) : (
                        <input
                          required={field.required}
                          type={field.type ?? 'text'}
                          min={field.type === 'number' ? 0 : undefined}
                          step={field.type === 'number' ? 'any' : undefined}
                          value={form[field.name] ?? ''}
                          readOnly={field.readOnly}
                          onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                          placeholder={field.placeholder}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <button type="submit" disabled={saving || Object.values(lookupLoading).some(Boolean)} className="min-h-11 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
