'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import ApplicationReviewPanel from '@/components/ApplicationReviewPanel';
import DirectoryPage from '@/components/DirectoryPage';
import PortalShell from '@/components/PortalShell';
import type { Placement } from '@/types/portal';
import { useAuth } from '@/context/AuthContext';

interface PlacementForm {
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  deadline: string;
  slots_available: string;
}

const blankPlacement: PlacementForm = {
  title: '',
  company: '',
  location: '',
  description: '',
  requirements: '',
  deadline: '',
  slots_available: '1',
};

function placementSearchText(placement: Placement): string {
  return `${placement.title} ${placement.company} ${placement.location} ${placement.description} ${placement.requirements}`;
}

export default function PlacementsPage() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null);
  const [placementForm, setPlacementForm] = useState(blankPlacement);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = user?.role === 'admin' || user?.role === 'officer';

  async function applyToPlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlacement) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append('cover_note', coverNote);
      if (cvFile) formData.append('cv_file', cvFile);
      await api.post(`/placements/${selectedPlacement.id}/apply/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotice(`Your application for ${selectedPlacement.title} has been submitted.`);
      setSelectedPlacement(null);
      setCoverNote('');
      setCvFile(null);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openCreateForm() {
    setEditingPlacement(null);
    setPlacementForm(blankPlacement);
    setFormError(null);
    setShowCreateForm(true);
  }

  function openEditForm(placement: Placement) {
    setEditingPlacement(placement);
    setPlacementForm({
      title: placement.title,
      company: placement.company,
      location: placement.location ?? '',
      description: placement.description ?? '',
      requirements: placement.requirements ?? '',
      deadline: placement.deadline?.slice(0, 10) ?? '',
      slots_available: String(placement.slots_available ?? 1),
    });
    setFormError(null);
    setShowCreateForm(true);
  }

  async function savePlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingPlacement) {
        await api.patch(`/placements/${editingPlacement.id}/`, {
          ...placementForm,
          slots_available: Number(placementForm.slots_available),
        });
        setNotice('Placement listing updated.');
      } else {
        await api.post('/placements/', {
          ...placementForm,
          slots_available: Number(placementForm.slots_available),
        });
        setNotice('The placement opportunity has been created.');
      }
      setShowCreateForm(false);
      setEditingPlacement(null);
      setPlacementForm(blankPlacement);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePlacement(placement: Placement) {
    if (!window.confirm(`Remove "${placement.title}" from the placement listings?`)) return;
    setFormError(null);
    try {
      await api.delete(`/placements/${placement.id}/`);
      setNotice('Placement listing removed.');
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  }

  return (
    <PortalShell roles={['student', 'lecturer', 'officer', 'admin']}>
      <div className="space-y-4">
        {notice && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="font-semibold">Dismiss</button>
          </div>
        )}
        {formError && !showCreateForm && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{formError}</p>
        )}
        {canManage && <ApplicationReviewPanel />}
        <DirectoryPage<Placement>
          title="Placements"
          description="Explore internships and job opportunities, or manage listings for students."
          endpoint="/placements/"
          searchPlaceholder="Search by role, employer, or location"
          emptyMessage="No placement opportunities found."
          refreshKey={refreshKey}
          getKey={(placement) => placement.id}
          clientSearch={placementSearchText}
          headerAction={canManage ? (
            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Add opportunity
            </button>
          ) : undefined}
          actionColumn={canManage ? {
            label: 'Actions',
            render: (placement) => {
              const canManageListing = user?.role === 'admin' || placement.posted_by?.id === user?.id;
              return canManageListing ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(placement)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePlacement(placement)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ) : <span className="text-xs text-slate-500">View only</span>;
            },
          } : user?.role === 'student' ? {
            label: 'Action',
            render: (placement) => (
              <button
                type="button"
                onClick={() => { setSelectedPlacement(placement); setFormError(null); }}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Apply
              </button>
            ),
          } : undefined}
          columns={[
            {
              label: 'Opportunity',
              render: (placement) => (
                <div className="max-w-xs">
                  <Link href={`/placements/${placement.id}`} className="font-semibold text-blue-700 hover:underline">{placement.title}</Link>
                  <p className="mt-1 text-xs text-slate-500">{placement.company}</p>
                </div>
              ),
            },
            { label: 'Location', render: (placement) => <span className="text-slate-600">{placement.location}</span> },
            { label: 'Slots', render: (placement) => <span className="text-slate-600">{placement.slots_available}</span> },
            {
              label: 'Deadline',
              render: (placement) => (
                <span className="text-slate-600">
                  {placement.deadline ? new Date(placement.deadline).toLocaleDateString() : '—'}
                </span>
              ),
            },
            {
              label: 'Status',
              render: (placement) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${placement.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {placement.is_active ? 'Open' : 'Closed'}
                </span>
              ),
            },
          ]}
        />
      </div>

      {(selectedPlacement || showCreateForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) {
            setSelectedPlacement(null);
            setShowCreateForm(false);
            setFormError(null);
          }
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="placement-dialog-title"
            className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="placement-dialog-title" className="text-xl font-bold">
                  {selectedPlacement ? `Apply: ${selectedPlacement.title}` : editingPlacement ? 'Edit placement' : 'Add a placement'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedPlacement ? 'Add a cover note and optionally attach your CV.' : editingPlacement ? 'Update the opportunity details.' : 'Share an opportunity with students.'}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => { setSelectedPlacement(null); setShowCreateForm(false); setEditingPlacement(null); setFormError(null); }}
                aria-label="Close dialog"
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {formError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</p>}

            {selectedPlacement ? (
              <form onSubmit={applyToPlacement} className="space-y-4">
                <label className="block text-sm font-medium text-slate-700" htmlFor="cover-note">
                  Cover note
                  <textarea
                    id="cover-note"
                    required
                    rows={6}
                    value={coverNote}
                    onChange={(event) => setCoverNote(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    placeholder="Tell the employer why you are interested…"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700" htmlFor="cv-file">
                  CV (optional)
                  <input
                    id="cv-file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
                  />
                </label>
                <button disabled={submitting} type="submit" className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit application'}
                </button>
              </form>
            ) : (
              <form onSubmit={savePlacement} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Title
                    <input required value={placementForm.title} onChange={(event) => setPlacementForm({ ...placementForm, title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Employer
                    <input required value={placementForm.company} onChange={(event) => setPlacementForm({ ...placementForm, company: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Location
                    <input required value={placementForm.location} onChange={(event) => setPlacementForm({ ...placementForm, location: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Available places
                    <input required type="number" min="1" step="1" value={placementForm.slots_available} onChange={(event) => setPlacementForm({ ...placementForm, slots_available: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">Application deadline
                  <input required type="date" value={placementForm.deadline} onChange={(event) => setPlacementForm({ ...placementForm, deadline: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Description
                  <textarea required rows={4} value={placementForm.description} onChange={(event) => setPlacementForm({ ...placementForm, description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="block text-sm font-medium text-slate-700">Requirements
                  <textarea required rows={3} value={placementForm.requirements} onChange={(event) => setPlacementForm({ ...placementForm, requirements: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </label>
                <button disabled={submitting} type="submit" className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                  {submitting ? 'Saving…' : editingPlacement ? 'Save changes' : 'Create opportunity'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </PortalShell>
  );
}
