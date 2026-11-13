import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Features | CampusHub",
};

const featureSections = [
  {
    id: "academics",
    title: "Academics",
    summary: "The academic workspace combines courses, lessons, assignments, materials, and attendance into the daily rhythm of teaching and learning.",
    routes: ["/dashboard", "/courses", "/assignments", "/lecturer/attendance", "/lecturer/materials"],
    details: [
      "Students can review their course work, upcoming deadlines, and learning materials from the main academic dashboard.",
      "Lecturers can manage lessons, attendance, and class resources with the same workflow they use for the unit itself.",
    ],
  },
  {
    id: "placements-career",
    title: "Placements & Career",
    summary: "The placement flow covers student applications, opportunity posting, and outcome tracking across the attachment journey.",
    routes: ["/placements", "/placements/[id]/apply", "/applications", "/placement-outcomes"],
    details: [
      "Students can find opportunities and submit applications directly from the portal.",
      "Placement officers and lecturers can follow applications and position visibility without leaving the same campus system.",
    ],
  },
  {
    id: "messaging",
    title: "Messaging",
    summary: "Direct and class-based communication keeps student and staff conversations close to the rest of campus operations.",
    routes: ["/messaging"],
    details: [
      "Users can carry on direct messages alongside class group chat and shared communication threads.",
      "This keeps updates, follow-ups, and notifications tied to the work being done rather than spread across external channels.",
    ],
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    summary: "The AI layer offers assistance for daily work, fed by role-aware context and human review before task output is acted on.",
    routes: ["/ai"],
    details: [
      "The assistant supports feed, chat, analytics, and task workflows that are scoped to the current user.",
      "Tasks return drafts for review rather than auto-publishing action, which keeps that layer aligned with a real campus control environment.",
    ],
  },
  {
    id: "resources-notifications",
    title: "Resources & Notifications",
    summary: "Announcements and resource updates move through the same channel as the rest of the portal, so students and staff see what matters quickly.",
    routes: ["/notifications", "/lecturer/materials"],
    details: [
      "Announcements and file resources can be shared into the core flow for a class or campus audience.",
      "Users see digest notifications, unread activity, and relevant campus updates without a separate system to manage.",
    ],
  },
  {
    id: "operations",
    title: "Operations",
    summary: "Operational modules for finance, admissions, hostels, library, and admin tools keep campus support functions connected to the same interface.",
    routes: ["/finance", "/admissions", "/hostels", "/library", "/admin", "/ict-admin", "/registrar"],
    details: [
      "Administrative teams can move between academic and operational dashboards without changing systems.",
      "This gives the campus a shared front door for student services, admin workflows, and institutional oversight.",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Feature set</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Everything campus teams need, in one portal</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
          CampusHub brings together the real student and staff workflows that are already active in the product: academics, placements, messaging, AI support, resources, notifications, and campus operations.
        </p>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
        {featureSections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">{section.title}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{section.title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{section.summary}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {section.routes.map((route) => (
                <span
                  key={route}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  {route}
                </span>
              ))}
            </div>

            <ul className="mt-6 space-y-3 text-base leading-7 text-slate-600">
              {section.details.map((detail) => (
                <li key={detail} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-700" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <SiteFooter />
    </main>
  );
}
