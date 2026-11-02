import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="relative z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">C</span>
            <span>Campus<span className="text-blue-700">Hub</span></span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/login" className="text-sm font-semibold text-slate-600 transition hover:text-blue-700">Log in</Link>
            <Link href="/register" className="rounded-xl bg-blue-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/15 transition hover:bg-blue-800 sm:px-5">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden bg-slate-50">
        <div aria-hidden="true" className="absolute -right-36 -top-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-blue-100/70 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-800 shadow-sm">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
              The campus, in sync
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Your campus life, <span className="text-blue-700">connected.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              One welcoming space for learning, teaching, campus resources, and the next step in your career.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800">
                Create a student account
              </Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">
                Sign in to CampusHub
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">Student registration is open. Staff accounts are managed by your campus administrator.</p>
          </div>

          <div aria-label="CampusHub features" className="relative mx-auto w-full max-w-lg">
            <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-blue-200/70 via-sky-100/60 to-emerald-100/70 blur-2xl" />
            <div className="relative rounded-[1.75rem] border border-white bg-white p-4 shadow-2xl shadow-slate-900/10 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Your campus workspace</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">Everything in one place</p>
                </div>
                <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl bg-blue-50/80 p-4">
                  <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                    </svg>
                  </span>
                  <h2 className="mt-3 font-bold text-slate-900">Learning</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Courses, lessons, assignments, and materials.</p>
                </article>
                <article className="rounded-2xl bg-emerald-50/80 p-4">
                  <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3m16.5-6.5-15 13m0-13 15 13" />
                    </svg>
                  </span>
                  <h2 className="mt-3 font-bold text-slate-900">Opportunities</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Explore placements and follow applications.</p>
                </article>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-slate-900">Made for your campus community</p>
                  <p className="mt-0.5 text-sm text-slate-600">A clearer path through your day, on any screen.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="campushub-features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">CampusHub, together</p>
          <h2 id="campushub-features" className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">A better-connected campus starts here</h2>
          <p className="mt-4 leading-7 text-slate-600">The essential tools students and staff use, brought together in one accessible portal.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {[
            { number: '01', title: 'Academic resources', description: 'Find course materials, announcements, and the information you need for class.' },
            { number: '02', title: 'Course management', description: 'Keep courses, departments, lecturers, and enrolments within easy reach.' },
            { number: '03', title: 'Career opportunities', description: 'Discover placements and manage applications from discovery to decision.' },
          ].map((feature) => (
            <article key={feature.number} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
              <p className="text-sm font-extrabold tracking-widest text-blue-700">{feature.number}</p>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="font-semibold text-slate-700">CampusHub</p>
          <p>Your campus community, connected.</p>
        </div>
      </footer>
    </main>
  );
}
