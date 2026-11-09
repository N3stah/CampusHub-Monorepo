'use client';

import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/context/AuthContext';
import ServiceOverview, { type ServiceMetric } from '@/components/ServiceOverview';

const hostelMetrics: ServiceMetric[] = [
  { label: 'Pending requests', endpoint: '/hostels/allocations/', params: { status: 'requested' }, href: '/hostels' },
  { label: 'Available rooms', endpoint: '/hostels/rooms/', params: { status: 'available' }, href: '/hostels' },
  { label: 'Current allocations', endpoint: '/hostels/allocations/', params: { status: 'allocated' }, href: '/hostels' },
];
const studentHostelMetrics: ServiceMetric[] = [
  { label: 'Available rooms', endpoint: '/hostels/rooms/', params: { status: 'available' }, href: '/hostels' },
  { label: 'My accommodation requests', endpoint: '/hostels/allocations/', params: { scope: 'self' }, href: '/hostels' },
];

const allocationStatuses = [
  { value: 'requested', label: 'Requested' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'checked_out', label: 'Checked out' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function HostelsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'hostel';

  return (
    <PortalShell roles={['student', 'hostel']}>
      <section className="space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Campus accommodation</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{canManage ? 'Hostel management' : 'Hostels and rooms'}</h1>
          <p className="mt-2 text-sm text-slate-600">{canManage ? 'Maintain accommodation inventory and student allocations.' : 'Review available accommodation and room capacity.'}</p>
        </header>
        <ServiceOverview title={canManage ? 'Accommodation workload' : 'My accommodation'} metrics={canManage ? hostelMetrics : studentHostelMetrics} />

        <ApiCrudWorkspace
          title="Hostels"
          description={canManage ? 'Create and maintain campus accommodation locations.' : 'Browse campus accommodation locations.'}
          endpoint="/hostels/"
          fields={canManage ? [
            { name: 'name', label: 'Hostel name', required: true },
            { name: 'location', label: 'Location', required: true },
            { name: 'gender_policy', label: 'Accommodation policy', options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'mixed', label: 'Mixed' }], required: true },
            { name: 'capacity', label: 'Total capacity', type: 'number', required: true },
            { name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], required: true },
            { name: 'description', label: 'Description', type: 'textarea' },
          ] : []}
          displayFields={['name', 'location', 'gender_policy', 'capacity', 'status']}
          filters={[{ name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }]}
          sortableFields={[{ value: 'name', label: 'Hostel name' }, { value: 'location', label: 'Location' }]}
          allowCreate={canManage}
          allowEdit={canManage}
          allowDelete={false}
        />

        <ApiCrudWorkspace
          title="Rooms"
          description={canManage ? 'Manage room details, occupancy, and availability.' : 'Review room availability.'}
          endpoint="/hostels/rooms/"
          fields={canManage ? [
            { name: 'hostel_id', label: 'Hostel', type: 'number', required: true, lookup: { endpoint: '/hostels/', labelFields: ['name', 'location'] } },
            { name: 'room_number', label: 'Room number', required: true },
            { name: 'capacity', label: 'Bed capacity', type: 'number', required: true },
            { name: 'occupied', label: 'Occupied beds', type: 'number', required: true, readOnly: true },
            { name: 'status', label: 'Status', options: [{ value: 'available', label: 'Available' }, { value: 'full', label: 'Full' }, { value: 'maintenance', label: 'Under maintenance' }], required: true },
          ] : []}
          displayFields={['hostel_name', 'room_number', 'capacity', 'occupied', 'status']}
          displayLabels={{ hostel_name: 'Hostel', room_number: 'Room', capacity: 'Bed capacity', occupied: 'Occupied beds' }}
          filters={[{ name: 'status', label: 'Status', options: [{ value: 'available', label: 'Available' }, { value: 'full', label: 'Full' }, { value: 'maintenance', label: 'Under maintenance' }] }]}
          sortableFields={[{ value: 'hostel_name', label: 'Hostel' }, { value: 'room_number', label: 'Room' }]}
          allowCreate={canManage}
          allowEdit={canManage}
          allowDelete={false}
        />

        {canManage ? (
          <ApiCrudWorkspace
            title="Allocations"
            description="Review requests, assign rooms, and update check-in or check-out status."
            endpoint="/hostels/allocations/"
            fields={[
              { name: 'student_id', label: 'Student', type: 'number', required: true, lookup: { endpoint: '/users/', params: { role: 'student' }, labelFields: ['admission_number', 'first_name', 'last_name', 'email'] } },
              { name: 'room_id', label: 'Room', type: 'number', required: true, lookup: { endpoint: '/hostels/rooms/', labelFields: ['hostel_name', 'room_number', 'capacity'] } },
              { name: 'academic_year', label: 'Academic year', placeholder: '2027/2028', required: true },
              { name: 'starts_on', label: 'Starts on', type: 'date', required: true },
              { name: 'ends_on', label: 'Ends on', type: 'date' },
              { name: 'status', label: 'Status', options: allocationStatuses, required: true },
            ]}
            displayFields={['student_name', 'room_label', 'academic_year', 'starts_on', 'ends_on', 'status']}
            displayLabels={{ student_name: 'Student', room_label: 'Room', academic_year: 'Academic year', starts_on: 'Starts', ends_on: 'Ends' }}
            filters={[{ name: 'status', label: 'Status', options: allocationStatuses }]}
            sortableFields={[{ value: 'starts_on', label: 'Start date' }, { value: '-created_at', label: 'Recently requested' }]}
            allowDelete={false}
          />
        ) : (
          <ApiCrudWorkspace
            title="My accommodation requests"
            description="Request a bed space and track allocation status."
            endpoint="/hostels/allocations/"
            fields={[
              { name: 'student_id', label: 'Student account', required: true, defaultValue: String(user?.id ?? ''), readOnly: true, hidden: true },
              { name: 'room_id', label: 'Available room', type: 'number', required: true, lookup: { endpoint: '/hostels/rooms/', params: { status: 'available' }, labelFields: ['hostel_name', 'room_number', 'capacity'] } },
              { name: 'academic_year', label: 'Academic year', placeholder: '2027/2028', required: true },
              { name: 'starts_on', label: 'Requested start date', type: 'date', required: true },
              { name: 'status', label: 'Status', required: true, defaultValue: 'requested', hidden: true },
            ]}
            displayFields={['hostel_name', 'room_number', 'academic_year', 'starts_on', 'status']}
            displayLabels={{ hostel_name: 'Hostel', room_number: 'Room', academic_year: 'Academic year', starts_on: 'Requested start', status: 'Request status' }}
            allowEdit={false}
            allowDelete={false}
            baseParams={{ scope: 'self' }}
          />
        )}
      </section>
    </PortalShell>
  );
}
