import Link from 'next/link';
import type { ReactNode } from 'react';

interface AdminCardProps {
  title: string;
  description: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
}

export default function AdminCard({ title, description, href, icon, badge }: AdminCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      {icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {badge && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className="mt-1 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-600"
      >
        →
      </span>
    </Link>
  );
}
