'use client';

import { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { EmptyState } from '@/components/ui';

const books = [
  { id: 1, title: 'Clean Code', author: 'Robert C. Martin', available: 3, category: 'Software Engineering' },
  { id: 2, title: 'Database System Concepts', author: 'Silberschatz, Korth & Sudarshan', available: 0, category: 'Databases' },
  { id: 3, title: 'Computer Networking', author: 'Andrew S. Tanenbaum', available: 2, category: 'Networks' },
];

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const visible = books.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <PortalShell roles={['student', 'librarian', 'admin']}>
      <section className="space-y-6">
        <header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Campus library</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Catalogue</h1></header>
        <label htmlFor="library-search" className="block"><span className="sr-only">Search catalogue</span><input id="library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, author, or category" className="w-full max-w-xl rounded-xl border border-slate-300 px-4 py-3" /></label>
        {visible.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{visible.map((book) => <article key={book.id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{book.category}</p><h2 className="mt-2 font-bold">{book.title}</h2><p className="mt-1 text-sm text-slate-600">{book.author}</p><p className={`mt-4 text-sm font-semibold ${book.available ? 'text-emerald-700' : 'text-red-700'}`}>{book.available ? `${book.available} copies available` : 'Currently on loan'}</p></article>)}</div> : <EmptyState title="No matching books" description="Try another title, author, or category." />}
      </section>
    </PortalShell>
  );
}
