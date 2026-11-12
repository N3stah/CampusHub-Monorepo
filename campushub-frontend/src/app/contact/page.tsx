import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Contact | CampusHub",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Contact</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">How to reach the CampusHub team</h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          The project is a public capstone and internship effort, and the most transparent way to reach the team is through the public repository and project issues.
        </p>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-4xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Project repo</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The public codebase for CampusHub is available on GitHub, including issue tracking and project updates.
            </p>
            <Link href="https://github.com/N3stah/CampusHub-Monorepo" target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800">
              Open GitHub repository
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Issues & feedback</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              For questions, feedback, or bug reports, the project issues page is the clearest public channel for updates and follow-up.
            </p>
            <Link href="https://github.com/N3stah/CampusHub-Monorepo/issues" target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">
              View issues
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">Built by</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Mark Manoti (N3stah) and Titus (Koech028) built CampusHub as part of the capstone and internship workflow during the 2026 program at The Nairobi National Polytechnic and Spin Mobile LLC.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
