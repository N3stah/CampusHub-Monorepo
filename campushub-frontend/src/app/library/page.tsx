'use client';

import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import ServiceOverview, { type ServiceMetric } from '@/components/ServiceOverview';

const libraryMetrics: ServiceMetric[] = [
  { label: 'Overdue loans', endpoint: '/library/loans/', params: { status: 'overdue' }, href: '/library' },
  { label: 'Ready for pickup', endpoint: '/library/reservations/', params: { status: 'ready' }, href: '/library' },
  { label: 'Active loans', endpoint: '/library/loans/', params: { status: 'active' }, href: '/library' },
];
const studentLibraryMetrics: ServiceMetric[] = [
  { label: 'My active loans', endpoint: '/library/loans/', params: { scope: 'self', status: 'active' }, href: '/library' },
  { label: 'My reservations', endpoint: '/library/reservations/', params: { scope: 'self' }, href: '/library' },
];

const circulationStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function LibraryPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'librarian';

  return (
    <PortalShell roles={['student', 'librarian']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{canManage ? 'Library services' : 'Campus library'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{canManage ? 'Library management' : 'Catalogue'}</h1>
          <p className="mt-2 text-sm text-slate-600">{canManage ? 'Maintain the catalogue and manage circulation and reservations.' : 'Search library items and check loan availability.'}</p>
        </header>
        <ServiceOverview title={canManage ? 'Library workload' : 'My library activity'} metrics={canManage ? libraryMetrics : studentLibraryMetrics} />

        <ApiCrudWorkspace
          title="Books"
          description={canManage ? 'Create, edit, and remove catalogue items.' : 'Search books currently in the catalogue.'}
          endpoint="/library/books/"
          fields={canManage ? [
            { name: 'isbn', label: 'ISBN' },
            { name: 'title', label: 'Title', required: true },
            { name: 'author', label: 'Author', required: true },
            { name: 'category', label: 'Category' },
            { name: 'total_copies', label: 'Total copies', type: 'number', required: true },
            { name: 'location', label: 'Shelf / location' },
            { name: 'status', label: 'Status', options: [{ value: 'available', label: 'Available' }, { value: 'inactive', label: 'Inactive' }], required: true },
          ] : []}
          displayFields={['title', 'author', 'category', 'available_copies', 'location']}
          displayLabels={{ available_copies: 'Available copies', location: 'Shelf / location' }}
          filters={[{ name: 'category', label: 'Category', options: [{ value: 'textbooks', label: 'Textbooks' }, { value: 'reference', label: 'Reference' }, { value: 'journals', label: 'Journals' }, { value: 'other', label: 'Other' }] }]}
          sortableFields={[{ value: 'title', label: 'Title' }, { value: 'author', label: 'Author' }]}
          allowCreate={canManage}
          allowEdit={canManage}
          allowDelete={false}
        />

        {canManage ? (
          <>
            <ApiCrudWorkspace
              title="Loans"
              description="Issue, update, and close book loans."
              endpoint="/library/loans/"
              fields={[
                { name: 'book_id', label: 'Book', type: 'number', required: true, lookup: { endpoint: '/library/books/', labelFields: ['title', 'author', 'isbn'] } },
                { name: 'student_id', label: 'Student', type: 'number', required: true, lookup: { endpoint: '/users/', params: { role: 'student' }, labelFields: ['admission_number', 'first_name', 'last_name', 'email'] } },
                { name: 'borrowed_on', label: 'Borrowed on', type: 'date', required: true },
                { name: 'due_date', label: 'Due date', type: 'date', required: true },
                { name: 'returned_on', label: 'Returned on', type: 'date' },
                { name: 'status', label: 'Status', options: circulationStatuses, required: true },
              ]}
              displayFields={['book_title', 'student_name', 'borrowed_on', 'due_date', 'returned_on', 'status']}
              displayLabels={{ book_title: 'Book', student_name: 'Student', borrowed_on: 'Borrowed on', due_date: 'Due date', returned_on: 'Returned on' }}
              filters={[{ name: 'status', label: 'Status', options: circulationStatuses }]}
              sortableFields={[{ value: 'due_date', label: 'Due date' }, { value: '-borrowed_on', label: 'Recently borrowed' }]}
              allowDelete={false}
            />
            <ApiCrudWorkspace
              title="Reservations"
              description="Manage student holds and reservation queues."
              endpoint="/library/reservations/"
              fields={[
                { name: 'book_id', label: 'Book', type: 'number', required: true, lookup: { endpoint: '/library/books/', labelFields: ['title', 'author', 'isbn'] } },
                { name: 'student_id', label: 'Student', type: 'number', required: true, lookup: { endpoint: '/users/', params: { role: 'student' }, labelFields: ['admission_number', 'first_name', 'last_name', 'email'] } },
                { name: 'reserved_on', label: 'Reserved on', type: 'date', required: true },
                { name: 'expires_on', label: 'Expires on', type: 'date' },
                { name: 'status', label: 'Status', options: [{ value: 'queued', label: 'Queued' }, { value: 'ready', label: 'Ready for pickup' }, { value: 'fulfilled', label: 'Fulfilled' }, { value: 'cancelled', label: 'Cancelled' }], required: true },
              ]}
              displayFields={['book_title', 'student_name', 'reserved_on', 'expires_on', 'status']}
              displayLabels={{ book_title: 'Book', student_name: 'Student', reserved_on: 'Reserved on', expires_on: 'Expires on' }}
              filters={[{ name: 'status', label: 'Status', options: [{ value: 'queued', label: 'Queued' }, { value: 'ready', label: 'Ready for pickup' }, { value: 'fulfilled', label: 'Fulfilled' }, { value: 'cancelled', label: 'Cancelled' }] }]}
              allowDelete={false}
            />
          </>
        ) : (
          <>
            <ApiCrudWorkspace
              title="My reservations"
              description="Place a hold on an available library item and track its reservation status."
              endpoint="/library/reservations/"
              fields={[
                { name: 'book_id', label: 'Book', type: 'number', required: true, lookup: { endpoint: '/library/books/', labelFields: ['title', 'author', 'isbn'] } },
                { name: 'student_id', label: 'Student account', required: true, defaultValue: String(user?.id ?? ''), readOnly: true, hidden: true },
                { name: 'reserved_on', label: 'Reserved on', type: 'date', required: true, defaultValue: () => new Date().toISOString().slice(0, 10), hidden: true },
                { name: 'status', label: 'Status', required: true, defaultValue: 'queued', hidden: true },
              ]}
              displayFields={['book_title', 'reserved_on', 'expires_on', 'status']}
              displayLabels={{ book_title: 'Book', reserved_on: 'Reserved on', expires_on: 'Expires on' }}
              allowEdit={false}
              allowDelete={false}
              baseParams={{ scope: 'self' }}
            />
            <ApiCrudWorkspace
              title="My loans"
              description="Review loan due dates, returns, and current status."
              endpoint="/library/loans/"
              fields={[]}
              displayFields={['book_title', 'borrowed_on', 'due_date', 'returned_on', 'status']}
              displayLabels={{ book_title: 'Book', borrowed_on: 'Borrowed on', due_date: 'Due date', returned_on: 'Returned on' }}
              allowCreate={false}
              allowEdit={false}
              allowDelete={false}
              baseParams={{ scope: 'self' }}
            />
          </>
        )}
      </section>
    </PortalShell>
  );
}
