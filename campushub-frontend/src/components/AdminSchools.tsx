'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { School } from '@/types/portal';

type SchoolForm = { name: string; code: string };
const emptyForm: SchoolForm = { name: '', code: '' };

export default function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [editing, setEditing] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSchools = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await getApiPage<School>('/academics/schools/', {}, signal);
      if (signal?.aborted) return;
      setSchools(page.results);
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadSchools(controller.signal));
    return () => controller.abort();
  }, [loadSchools]);

  async function saveSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase() };
    try {
      if (editing) {
        await api.patch(`/academics/schools/${editing.id}/`, payload);
        setNotice('School updated.');
      } else {
        await api.post('/academics/schools/', payload);
        setNotice('School created.');
      }
      setEditing(null);
      setForm(emptyForm);
      await loadSchools();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function editSchool(school: School) {
    setEditing(school);
    setForm({ name: school.name, code: school.code });
    setError(null);
    setNotice(null);
  }

  async function deleteSchool(school: School) {
    if (school.department_count) {
      setError('This school still has departments. Move the departments to another school first.');
      return;
    }
    if (!window.confirm(`Delete ${school.name}? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/academics/schools/${school.id}/`);
      setNotice(`${school.name} deleted.`);
      await loadSchools();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Administration</Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-blue-700">Academic structure</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Schools</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Create the top-level academic units first. Departments belong to one school; programmes then belong to departments.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <form onSubmit={saveSchool} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-semibold">{editing ? 'Edit school' : 'Add school'}</h2>
            <p className="mt-1 text-xs text-slate-500">Use the institution’s official school name and short code.</p>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            School name
            <input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            School code
            <input required maxLength={20} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 uppercase" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add school'}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>}
          </div>
        </form>

        <section aria-labelledby="school-list-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id="school-list-heading" className="font-semibold">School directory</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{schools.length}</span>
          </div>
          {loading ? <p role="status" className="p-6 text-sm text-slate-500">Loading schools…</p> : schools.length ? (
            <ul className="divide-y divide-slate-100">
              {schools.map((school) => (
                <li key={school.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{school.name}{school.code === 'UNASSIGNED' && <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-800">Needs review</span>}</p>
                    <p className="mt-1 text-xs text-slate-500">{school.code} · {school.department_count} department{school.department_count === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={school.code === 'UNASSIGNED' && school.department_count > 0} title={school.code === 'UNASSIGNED' && school.department_count > 0 ? 'Move all existing departments before renaming this placeholder' : undefined} onClick={() => editSchool(school)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                    <button type="button" onClick={() => void deleteSchool(school)} disabled={school.department_count > 0} title={school.department_count ? 'Move departments before deleting this school' : undefined} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="p-6 text-sm text-slate-500">No schools yet. Create one to start building the academic structure.</p>}
          {schools.some((school) => school.code === 'UNASSIGNED') && <p className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">Existing departments were kept safe under this temporary school during upgrade. Edit each department to move it to the correct school, then rename or remove this placeholder once it is empty.</p>}
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm">
            <Link href="/admin/departments" className="font-semibold text-blue-700 hover:underline">Next: set up departments →</Link>
          </div>
        </section>
      </div>
    </section>
  );
}
