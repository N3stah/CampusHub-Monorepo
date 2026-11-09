'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiErrorMessage, getApiPage } from '@/lib/portal';

export interface ServiceMetric {
  label: string;
  endpoint: string;
  href: string;
  params?: Record<string, string | number>;
}

interface ServiceOverviewProps {
  title: string;
  metrics: ServiceMetric[];
}

export default function ServiceOverview({ title, metrics }: ServiceOverviewProps) {
  const [values, setValues] = useState<Record<string, { count: number | null; error: string | null }>>({});

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      const results = await Promise.all(metrics.map(async (metric) => {
        try {
          const page = await getApiPage<unknown>(metric.endpoint, metric.params ?? {}, controller.signal);
          return [metric.label, { count: page.count, error: null }] as const;
        } catch (error) {
          return [metric.label, { count: null, error: getApiErrorMessage(error) }] as const;
        }
      }));
      if (!controller.signal.aborted) setValues(Object.fromEntries(results));
    });
    return () => controller.abort();
  }, [metrics]);

  return (
    <section aria-label={`${title} summary`} className="space-y-3">
      <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const value = values[metric.label];
          return (
            <Link key={metric.label} href={metric.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span className="text-sm font-medium text-slate-600">{metric.label}</span>
              <span className="mt-2 block text-2xl font-bold text-slate-900" aria-live="polite">
                {!value ? 'Loading…' : value.error ? 'Unavailable' : value.count}
              </span>
              {value?.error && <span className="mt-1 block text-xs text-amber-800">{value.error}</span>}
              <span className="mt-2 block text-xs font-semibold text-blue-700">Open list →</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
