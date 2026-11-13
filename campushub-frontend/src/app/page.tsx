import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="relative z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">C</span>
            <span>Campus<span className="text-blue-700">Hub</span></span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="#campushub-features" className="hidden text-sm font-semibold text-slate-600 transition hover:text-blue-700 sm:inline-flex">Explore</Link>
            <Link href="/forgot-password" className="hidden text-sm font-semibold text-slate-600 transition hover:text-blue-700 sm:inline-flex">Forgot password?</Link>
            <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white transition hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">Log in</Link>
          </div>
        </nav>
      </header>

      <section aria-labelledby="home-title" className="relative isolate min-h-[680px] overflow-hidden bg-white md:min-h-[620px] lg:min-h-[680px]">
        <Image
          src="/campushub-campus-hero.png"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 80vw, 100vw"
          className="hidden object-cover object-center md:block"
        />
        <Image
          src="/campushub-students.png"
          alt=""
          width={823}
          height={374}
          priority
          sizes="100vw"
          className="absolute inset-x-0 bottom-0 z-0 h-auto max-h-[39%] w-full object-contain md:hidden"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-0 hidden w-[80%] bg-gradient-to-br from-[#eef7f8] via-[#f6fbfb] to-[#e8f4f5] md:block"
          style={{ clipPath: 'polygon(0 0, 90% 0, 76% 100%, 0 100%)' }}
        />
        <div className="relative z-10 mx-auto flex min-h-[680px] max-w-7xl items-center px-5 pb-72 pt-12 sm:px-8 md:min-h-[620px] md:px-12 md:pb-12 lg:min-h-[680px] lg:px-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-900 shadow-sm">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
              Your campus, all in one place
            </p>
            <h1 id="home-title" className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight text-[#12385e] sm:text-6xl lg:text-7xl">
              CampusHub
            </h1>
            <p className="mt-4 text-xl font-semibold leading-snug text-[#173c61] sm:text-2xl">
              A central portal for campus life.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">
              Connect to learning, campus resources, placements, and essential services in one welcoming space.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">
                Sign in to CampusHub
              </Link>
              <Link href="#campushub-features" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">
                Explore features
              </Link>
            </div>
            <p className="mt-5 max-w-lg text-xs leading-5 text-slate-600">
              Student and staff accounts are provided by authorized campus offices. Check your email for your initial sign-in details.
            </p>
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
