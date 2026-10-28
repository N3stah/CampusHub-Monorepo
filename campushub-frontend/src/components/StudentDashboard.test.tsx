import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentDashboard from '@/components/StudentDashboard';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

beforeEach(() => {
  vi.mocked(getApiPage).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  vi.mocked(mocks.api.get).mockResolvedValue({ data: [] });
});

describe('student dashboard', () => {
  it('keeps the overview calendar without a link to a full calendar page', async () => {
    render(<StudentDashboard />);

    expect(await screen.findByRole('heading', { name: 'My courses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /full calendar/i })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith(
      '/academics/calendar/',
      expect.objectContaining({ params: expect.any(Object), signal: expect.any(AbortSignal) }),
    ));
  });
});
