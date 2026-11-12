import Link from "next/link";

export function SiteFooter() {
  const year = 2026;

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">
              C
            </span>
            <span>
              Campus<span className="text-blue-700">Hub</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
            A single campus portal for academics, placements, messaging, and daily operations across the student lifecycle.
          </p>
          <Link href="https://github.com/N3stah/CampusHub-Monorepo" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800">
            View project on GitHub
          </Link>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Product</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li><Link href="/#roles" className="transition hover:text-blue-700">Roles</Link></li>
            <li><Link href="/#features" className="transition hover:text-blue-700">Features</Link></li>
            <li><Link href="/#how-it-works" className="transition hover:text-blue-700">How it works</Link></li>
            <li><Link href="/features" className="transition hover:text-blue-700">Feature breakdown</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">About</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li><Link href="/about" className="transition hover:text-blue-700">About CampusHub</Link></li>
            <li><Link href="/contact" className="transition hover:text-blue-700">Contact</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-4 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <p>
            © {year} CampusHub · One portal for campus life
          </p>
        </div>
      </div>
    </footer>
  );
}
