'use client';

import { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Button } from '@/components/ui';

const rooms = [
  { id: 1, hostel: 'Riverside Block A', room: 'A-204', capacity: 4, occupied: 3 },
  { id: 2, hostel: 'Riverside Block B', room: 'B-112', capacity: 2, occupied: 2 },
  { id: 3, hostel: 'Kilimanjaro House', room: 'K-031', capacity: 4, occupied: 1 },
];

export default function HostelsPage() {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <PortalShell roles={['student', 'hostel', 'admin']}>
      <section className="space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Campus accommodation</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Hostels and room allocation</h1></header>
        {notice && <Alert tone="success">{notice}</Alert>}
        <div className="grid gap-4 md:grid-cols-3">{rooms.map((room) => <article key={room.id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{room.hostel}</p><h2 className="mt-2 text-xl font-bold">Room {room.room}</h2><p className="mt-1 text-sm text-slate-600">{room.capacity - room.occupied} bed spaces available</p><Button tone="secondary" className="mt-4 w-full" onClick={() => setNotice(`Room ${room.room} selected for allocation review.`)} disabled={room.capacity === room.occupied}>Request bed</Button></article>)}</div>
      </section>
    </PortalShell>
  );
}
