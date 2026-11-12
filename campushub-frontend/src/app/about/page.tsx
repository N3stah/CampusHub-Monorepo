import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "About | CampusHub",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">About CampusHub</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">One campus portal, instead of fragmented systems</h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          CampusHub brings the student journey into one place: academics, placement activity, communication, AI support, and the many operational tools a campus relies on every day.
        </p>
        <p className="mt-5 text-base leading-7 text-slate-600">
          The real problem it solves is familiar across higher education: information gets spread across different systems, people are forced to chase updates in several places, and the student experience becomes harder than it needs to be. CampusHub aims to reduce that friction by making the core campus workflow visible and easier to navigate.
        </p>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-4xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Who built it</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              CampusHub was built as a capstone and internship project by Mark Manoti (N3stah) and Titus (Koech028), with the project grounded in a real campus workflow and a role-based access model.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">What it runs on</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The product is built with Django on the backend and Next.js on the frontend, with role-aware access across 11 campus roles and an AI assistant layered on top where it adds value.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">What this means in practice</h2>
        <ul className="mt-5 space-y-3 text-base leading-7 text-slate-600">
          <li>• Students can keep track of coursework, announcements, and placement activity in one place.</li>
          <li>• Lecturers can manage course delivery, attendance, and materials without juggling separate tools.</li>
          <li>• Administrative staff can support admissions, finance, library, hostel, and system oversight through the same campus workflow.</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800">
            Explore the feature set
          </Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">
            Contact the team
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
