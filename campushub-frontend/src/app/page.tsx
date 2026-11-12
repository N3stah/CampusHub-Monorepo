import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const spotlightRoles = [
  {
    title: "Student",
    bullets: [
      "Track courses, lessons, and assignments in one place",
      "Review placement opportunities and applications",
      "Message peers and class groups without leaving the portal",
    ],
  },
  {
    title: "Lecturer",
    bullets: [
      "Take attendance and manage lessons",
      "Post scheduled announcements to a class",
      "See where each student is placed for their attachment",
    ],
  },
  {
    title: "Placement Officer",
    bullets: [
      "Manage placements and review applications",
      "Keep students informed through the core portal",
      "Coordinate placement outcomes with the wider team",
    ],
  },
  {
    title: "Admin",
    bullets: [
      "Administer users, access, and institutional records",
      "Monitor system activity and operational data",
      "Support the full campus workflow from a single dashboard",
    ],
  },
];

const remainingRoles = [
  "ICT Administrator",
  "Registrar / Academic Officer",
  "Finance Officer",
  "Dean / Head of Department",
  "Examinations Officer",
  "Librarian",
  "Hostel Warden",
];

const featureCards = [
  {
    id: "academics",
    title: "Academics",
    description: "Courses, attendance, assignments, lessons, and materials stay connected to the academic workflow.",
    href: "/features#academics",
    icon: "academic",
  },
  {
    id: "placements-career",
    title: "Placements & Career",
    description: "Help students discover opportunities, apply in context, and track outcomes through the placement process.",
    href: "/features#placements-career",
    icon: "placements",
  },
  {
    id: "messaging",
    title: "Messaging",
    description: "Support direct communication and class group chat in the same system students and staff already use.",
    href: "/features#messaging",
    icon: "messaging",
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    description: "Surface role-scoped insight and task drafts where they add value without bypassing human review.",
    href: "/features#ai-assistant",
    icon: "ai",
  },
  {
    id: "resources-notifications",
    title: "Resources & Notifications",
    description: "Share announcements, file resources, and timely updates from a single operational hub.",
    href: "/features#resources-notifications",
    icon: "resources",
  },
  {
    id: "operations",
    title: "Operations",
    description: "Finance, admissions, hostels, library, and admin tooling sit alongside the learning side of campus life.",
    href: "/features#operations",
    icon: "operations",
  },
];

const howItWorks = [
  "Your institution sets up your account",
  "You sign in with your campus credentials",
  "Your dashboard is tailored to your role automatically",
  "You act on real-time academic, placement, and messaging updates — with AI insight surfaced where it is useful",
];

function FeatureIcon({ name }: { name: string }) {
  const common = "h-5 w-5";

  switch (name) {
    case "academics":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      );
    case "placements":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-3.58 8-8.95C20.89 9.58 17.68 5 12 5S3.11 9.58 4 12.05C6 17.42 12 21 12 21Z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
      );
    case "messaging":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 18.5V20l2.5-1.5h9A2.5 2.5 0 0 0 21 16V7.5A2.5 2.5 0 0 0 18.5 5h-13A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19H7Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9.5h8M8 13h6" />
        </svg>
      );
    case "ai":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.75v3.5M12 17.75v3.5M4.75 12h3.5M15.75 12h3.5M6.6 6.6l2.45 2.45M14.95 14.95l2.45 2.45M17.4 6.6l-2.45 2.45M9.05 14.95l-2.45 2.45" />
          <circle cx="12" cy="12" r="4.25" />
        </svg>
      );
    case "resources":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4.5h7.5L18 9v10.5A1.5 1.5 0 0 1 16.5 21h-10A1.5 1.5 0 0 1 5 19.5v-13A1.5 1.5 0 0 1 6.5 5H6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5V9H18" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10H7zM4 12h3M17 12h3M12 4v3M12 17v3" />
        </svg>
      );
  }
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="relative isolate overflow-hidden bg-slate-50">
        <div aria-hidden="true" className="absolute -right-28 -top-28 -z-10 h-[28rem] w-[28rem] rounded-full bg-blue-100/70 blur-3xl" />
        <div className="absolute left-8 top-12 -z-10 h-32 w-32 rounded-full bg-emerald-100/70 blur-3xl" aria-hidden="true" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-blue-800 shadow-sm">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
              The campus, in sync
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              One portal for every role on campus
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Academics, placements, messaging, and AI insight come together in one system for students, lecturers, and administrators.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">
                Sign in to CampusHub
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Student and staff accounts are provisioned by authorized campus offices. Check your email for your initial sign-in details.
            </p>
          </div>

          <div aria-label="CampusHub workspace preview" className="relative mx-auto w-full max-w-lg">
            <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-blue-200/70 via-sky-100/60 to-emerald-100/70 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/82 backdrop-blur-md p-4 shadow-2xl shadow-slate-900/10 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Campus workspace</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">Today at a glance</p>
                </div>
                <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                  </svg>
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Monday schedule</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">3 classes</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      ["Database Systems", "09:00"],
                      ["Career Lab", "11:30"],
                      ["Research Seminar", "14:00"],
                    ].map(([label, time]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-slate-500">{time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">Unread</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">12</p>
                    <p className="text-sm text-slate-600">Messages and announcements</p>
                  </article>
                  <article className="rounded-2xl bg-gradient-to-br from-blue-50 via-blue-50 to-teal-50 p-4 ring-1 ring-blue-100/50">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-blue-700">AI insight</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Placement deadline approaching</p>
                    <p className="mt-1 text-xs text-slate-600">Suggested review for 3 students</p>
                  </article>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Priority</p>
                      <p className="mt-1 font-semibold text-slate-900">Attachment applications</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs review</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Built for every role</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">11 roles, one portal</h2>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {spotlightRoles.map((role) => (
            <article key={role.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-10px_rgba(15,23,42,0.1)]">
              <h3 className="text-xl font-bold text-slate-900">{role.title}</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                {role.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-700" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {remainingRoles.map((role) => (
            <div key={role} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              {role}
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="scroll-mt-24 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Everything in one portal</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Campus operations, all in one view</h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature) => (
              <Link key={feature.id} href={feature.href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-10px_rgba(15,23,42,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm">
                  <FeatureIcon name={feature.icon} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  Explore
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">A simple flow, built around real campus operations</h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {howItWorks.map((step, index) => (
            <div key={step} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Step {index + 1}</span>
              </div>
              <p className="mt-5 text-base font-medium leading-7 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-700 py-14 text-white sm:py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 lg:flex-row lg:text-left lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-100">CampusHub</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Keep every campus workflow in one place</h2>
          </div>
          <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700">
            Sign in to CampusHub
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
