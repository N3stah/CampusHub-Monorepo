import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentDashboard from '@/components/StudentDashboard';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
}));

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
});

describe('student dashboard', () => {
  it('keeps the overview calendar without a link to a full calendar page', async () => {
    render(<StudentDashboard />);

    expect(await screen.findByRole('heading', { name: 'My courses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /full calendar/i })).not.toBeInTheDocument();
    await waitFor(() => expect(getApiPage).toHaveBeenCalledWith(
      '/academics/calendar/',
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.any(AbortSignal),
    ));
  });

  it('renders calendar events from the paginated results envelope', async () => {
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    vi.mocked(getApiPage).mockImplementation(async (endpoint) => ({
      count: endpoint === '/academics/calendar/' ? 1 : 0,
      next: null,
      previous: null,
      results: endpoint === '/academics/calendar/'
        ? [{
          id: 'class-1',
          kind: 'class',
          title: 'Database lecture',
          unit_code: 'CS101',
          offering_id: 1,
          date,
          start_time: '10:00',
          end_time: '11:00',
          location: 'Room 2',
          due_at: null,
        }]
        : [],
    }));

    render(<StudentDashboard />);

    expect(await screen.findByText('Database lecture')).toBeInTheDocument();
    expect(screen.getByText('Room 2')).toBeInTheDocument();
  });
});
