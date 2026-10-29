'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';
import type { AcademicUnit, CourseResource, UnitLesson } from '@/types/portal';

interface TeachingOffering {
  id: number;
  unitCode: string;
  unitTitle: string;
  courseCode: string;
  courseTitle: string;
}

interface UnitMaterial extends CourseResource {
  offeringId: number;
  unitCode: string;
  unitTitle: string;
  courseCode: string;
  courseTitle: string;
}

interface MaterialsToast {
  kind: 'success' | 'error';
  message: string;
}

const FILE_TYPES = '.pdf,.docx,.pptx,.xlsx,.png,.jpg';
const MATERIALS_PER_PAGE = 12;

export default function LecturerMaterialsPage() {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<TeachingOffering[]>([]);
  const [materials, setMaterials] = useState<UnitMaterial[]>([]);
  const [lessons, setLessons] = useState<UnitLesson[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [materialPage, setMaterialPage] = useState(1);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'notes' | 'topic'>('notes');
  const [lessonId, setLessonId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<MaterialsToast | null>(null);

  const loadMaterials = useCallback(async (signal?: AbortSignal) => {
    try {
      const unitsPage = await getApiPage<AcademicUnit>('/academics/units/', {}, signal);
      const assigned = unitsPage.results.flatMap((unit) => unit.offerings
        .filter((offering) => offering.lecturers.some((lecturer) => lecturer.id === user?.id))
        .map((offering) => ({
          id: offering.offering_id,
          unitCode: unit.code,
          unitTitle: unit.title,
          courseCode: offering.course_code,
          courseTitle: offering.course_title,
        })));
      const requestedOffering = typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('offeringId');
      const results = await Promise.all(assigned.map(async (offering) => {
        const [resourcePage, lessonResponse] = await Promise.all([
          getApiPage<CourseResource>(`/resources/offerings/${offering.id}/resources/`, {}, signal),
          api.get<UnitLesson[]>(`/academics/offerings/${offering.id}/lessons/`, { signal }),
        ]);
        return {
          offerings: offering,
          resources: resourcePage.results.map((resource) => ({
            ...resource,
            offeringId: offering.id,
            unitCode: offering.unitCode,
            unitTitle: offering.unitTitle,
            courseCode: offering.courseCode,
            courseTitle: offering.courseTitle,
          })),
          lessons: lessonResponse.data.map((lesson) => ({ ...lesson, offering_id: offering.id })),
        };
      }));
      if (signal?.aborted) return;
      setOfferings(assigned);
      setMaterials(results.flatMap((result) => result.resources).sort((left, right) => (
        new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime()
      )));
      setLessons(results.flatMap((result) => result.lessons));
      setSelectedOfferingId((current) => current && assigned.some((offering) => String(offering.id) === current)
        ? current
        : requestedOffering && assigned.some((offering) => String(offering.id) === requestedOffering)
          ? requestedOffering
          : String(assigned[0]?.id ?? ''));
      setError(null);
    } catch (requestError) {
      if (!signal?.aborted) setError(getApiErrorMessage(requestError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadMaterials(controller.signal));
    return () => controller.abort();
  }, [loadMaterials]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedOffering = offerings.find((offering) => String(offering.id) === selectedOfferingId);
  const offeringLessons = lessons.filter((lesson) => String(lesson.offering_id) === selectedOfferingId);
  const filteredMaterials = useMemo(() => materials.filter((material) => {
    if (selectedOfferingId && String(material.offeringId) !== selectedOfferingId) return false;
    if (categoryFilter !== 'all' && material.category !== categoryFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || [
      material.title,
      material.description ?? '',
      material.unitCode,
      material.unitTitle,
      material.courseCode,
      material.lesson_title ?? '',
    ].some((value) => value.toLowerCase().includes(query));
  }), [categoryFilter, materials, search, selectedOfferingId]);
  const materialPageCount = Math.max(1, Math.ceil(filteredMaterials.length / MATERIALS_PER_PAGE));
  const currentMaterialPage = Math.min(materialPage, materialPageCount);
  const visibleMaterials = filteredMaterials.slice((currentMaterialPage - 1) * MATERIALS_PER_PAGE, currentMaterialPage * MATERIALS_PER_PAGE);

  async function uploadMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedOffering || !title.trim() || !file) {
      setToast({ kind: 'error', message: 'Select a unit, enter a title, and choose a file.' });
      return;
    }
    if (!FILE_TYPES.split(',').some((extension) => file.name.toLowerCase().endsWith(extension)) || file.size > 10 * 1024 * 1024) {
      setToast({ kind: 'error', message: 'Choose a PDF, DOCX, PPTX, XLSX, PNG, or JPG file no larger than 10MB.' });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const payload = new FormData();
      payload.append('title', title.trim());
      payload.append('description', description.trim());
      payload.append('category', category);
      if (lessonId) payload.append('lesson_id', lessonId);
      payload.append('file', file);
      await api.post(`/resources/offerings/${selectedOffering.id}/resources/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTitle('');
      setDescription('');
      setLessonId('');
      setFile(null);
      form.reset();
      setToast({ kind: 'success', message: `${category === 'notes' ? 'Notes' : 'Learning material'} uploaded to ${selectedOffering.unitCode}.` });
      await loadMaterials();
    } catch (requestError) {
      setToast({ kind: 'error', message: getApiErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMaterial(material: UnitMaterial) {
    if (!window.confirm(`Delete "${material.title}"? This removes the file from students too.`)) return;
    setDeletingId(material.id);
    setToast(null);
    try {
      await api.delete(`/resources/offerings/${material.offeringId}/resources/${material.id}/`);
      setMaterials((current) => current.filter((item) => item.id !== material.id || item.offeringId !== material.offeringId));
      setToast({ kind: 'success', message: `"${material.title}" was deleted.` });
    } catch (requestError) {
      setToast({ kind: 'error', message: getApiErrorMessage(requestError) });
    } finally {
      setDeletingId(null);
    }
  }

  const notesCount = materials.filter((material) => material.category === 'notes').length;
  const topicCount = materials.filter((material) => material.category === 'topic').length;

  return (
    <PortalShell roles={['lecturer']}>
      <section className="space-y-5">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Teaching resources</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div><h1 className="text-3xl font-bold tracking-tight">Learning materials &amp; notes</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Publish and organize learning resources for every unit in one place. Schedule class sessions from Lesson plan.</p></div>
            <div className="flex gap-2 text-sm"><span className="rounded-xl bg-white/15 px-3 py-2"><strong>{materials.length}</strong> resources</span></div>
          </div>
        </header>

        {toast && <div role={toast.kind === 'error' ? 'alert' : 'status'} className={`fixed right-4 top-20 z-50 flex max-w-md items-start gap-3 rounded-xl border p-4 shadow-xl ${toast.kind === 'success' ? 'border-emerald-200 bg-white text-emerald-900' : 'border-red-200 bg-white text-red-900'}`}>
          <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toast.kind === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>{toast.kind === 'success' ? '✓' : '!'}</span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button type="button" aria-label="Dismiss message" onClick={() => setToast(null)} className="rounded px-1 text-slate-400 hover:text-slate-700">×</button>
        </div>}

        {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your teaching resources…</p> : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5"><p role="alert" className="text-sm text-red-800">{error}</p><button type="button" onClick={() => { setLoading(true); void loadMaterials(); }} className="mt-2 text-sm font-semibold text-red-900 underline">Try again</button></div>
        ) : !offerings.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="font-semibold">No units assigned yet</h2><p className="mt-2 text-sm text-slate-500">Once you are assigned to a unit, you can publish its learning materials here.</p><Link href="/lecturer/units" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">View units</Link></div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => { setCategoryFilter('all'); setMaterialPage(1); }} className={`rounded-xl border bg-white p-4 text-left shadow-sm ${categoryFilter === 'all' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">All resources</span><span className="mt-1 block text-2xl font-bold">{materials.length}</span></button>
              <button type="button" onClick={() => { setCategoryFilter('notes'); setMaterialPage(1); }} className={`rounded-xl border bg-white p-4 text-left shadow-sm ${categoryFilter === 'notes' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}><span className="text-xs font-semibold uppercase tracking-wide text-blue-700">Notes</span><span className="mt-1 block text-2xl font-bold">{notesCount}</span></button>
              <button type="button" onClick={() => { setCategoryFilter('topic'); setMaterialPage(1); }} className={`rounded-xl border bg-white p-4 text-left shadow-sm ${categoryFilter === 'topic' ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'}`}><span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Topic materials</span><span className="mt-1 block text-2xl font-bold">{topicCount}</span></button>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.8fr)]">
              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-[minmax(12rem,0.75fr)_minmax(14rem,1fr)]">
                    <label className="block text-sm font-medium text-slate-700">Unit / course<select aria-label="Filter by unit" value={selectedOfferingId} onChange={(event) => { setSelectedOfferingId(event.target.value); setLessonId(''); setMaterialPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All assigned units</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.unitCode} · {offering.courseCode} — {offering.unitTitle}</option>)}</select></label>
                    <label className="block text-sm font-medium text-slate-700">Search materials<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setMaterialPage(1); }} placeholder="Title, unit, or lesson" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
                  </div>
                </section>

                {visibleMaterials.length ? <ul className="grid gap-3 md:grid-cols-2">
                  {visibleMaterials.map((material) => (
                    <li key={`${material.offeringId}-${material.id}`} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${material.category === 'notes' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>{material.category ?? 'Resource'}</span>
                        <button type="button" onClick={() => void deleteMaterial(material)} disabled={deletingId === material.id} aria-label={`Delete ${material.title}`} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{deletingId === material.id ? '…' : 'Delete'}</button>
                      </div>
                      <h2 className="mt-3 font-semibold text-slate-900">{material.title}</h2>
                      <p className="mt-1 text-xs font-medium text-blue-700">{material.unitCode} · {material.courseCode} · {material.unitTitle}</p>
                      {material.lesson_title && <p className="mt-2 text-xs text-slate-500">{material.lesson_title}</p>}
                      {material.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{material.description}</p>}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-400">{material.created_at ? new Date(material.created_at).toLocaleDateString() : ''}{material.file_type ? ` · ${material.file_type.toUpperCase()}` : ''}</span>
                        {material.file_url && <a href={material.file_url} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Open material ↗</a>}
                      </div>
                    </li>
                  ))}
                </ul> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-semibold text-slate-800">{filteredMaterials.length || materials.length ? 'No matching materials' : 'No learning materials yet'}</p><p className="mt-1 text-sm text-slate-500">{filteredMaterials.length || materials.length ? 'Try another unit or search term.' : 'Use the upload panel to add your first set of notes or topic resources.'}</p></div>}
                {filteredMaterials.length > MATERIALS_PER_PAGE && <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs text-slate-500">Showing {(currentMaterialPage - 1) * MATERIALS_PER_PAGE + 1}–{Math.min(currentMaterialPage * MATERIALS_PER_PAGE, filteredMaterials.length)} of {filteredMaterials.length} resources</p><div className="flex items-center gap-2"><button type="button" disabled={currentMaterialPage <= 1} onClick={() => setMaterialPage(currentMaterialPage - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">{currentMaterialPage} / {materialPageCount}</span><button type="button" disabled={currentMaterialPage >= materialPageCount} onClick={() => setMaterialPage(currentMaterialPage + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button></div></div>}
              </div>

              <div className="space-y-4">
                <form onSubmit={uploadMaterial} className="space-y-3 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Publish resource</p><h2 className="mt-1 text-lg font-semibold">Add learning material</h2><p className="mt-1 text-xs text-slate-500">Files up to 10MB. Students in the selected course will be notified.</p></div>
                  <label className="block text-xs font-semibold text-slate-700">Unit / course<select aria-label="Select unit for material" value={selectedOfferingId} onChange={(event) => { setSelectedOfferingId(event.target.value); setLessonId(''); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Choose a unit</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.unitCode} · {offering.courseCode} — {offering.unitTitle}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700">Type<select value={category} onChange={(event) => setCategory(event.target.value as 'notes' | 'topic')} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="notes">Notes</option><option value="topic">Topic material</option></select></label>
                    <label className="block text-xs font-semibold text-slate-700">Lesson<select value={lessonId} onChange={(event) => setLessonId(event.target.value)} disabled={!selectedOfferingId} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">No lesson</option>{offeringLessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>Lesson {index + 1}: {lesson.title}</option>)}</select></label>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700">Title<input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introduction to databases" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
                  <label className="block text-xs font-semibold text-slate-700">Description (optional)<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
                  <label className="block text-xs font-semibold text-slate-700">File<input type="file" accept={FILE_TYPES} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:font-semibold file:text-blue-800" /></label>
                  <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50">{saving ? 'Uploading…' : 'Upload to students'}</button>
                </form>

              </div>
            </div>
            {selectedOffering && <p className="text-xs text-slate-400">Managing resources for {selectedOffering.unitCode} · {selectedOffering.courseCode} · {selectedOffering.courseTitle}</p>}
          </>
        )}
      </section>
    </PortalShell>
  );
}
