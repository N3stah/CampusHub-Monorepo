import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentDashboard from '@/components/StudentDashboard';
import { getApiPage } from '@/lib/portal';
import type { CalendarEvent } from '@/types/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn() },
}));

vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

beforeEach(() => {
  vi.mocked(getApiPage).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  mocks.api.get.mockResolvedValue({
    data: {
      courses: [],
      upcoming_assignments: [],
      pending_submissions_count: 0,
      recent_grades: [],
      groups: [],
    },
  });
});

describe('student dashboard', () => {
  it('keeps the overview calendar without a link to a full calendar page', async () => {
    render(<StudentDashboard />);

    expect(await screen.findByRole('heading', { name: 'My units' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /full calendar/i })).not.toBeInTheDocument();
    await waitFor(() => expect(getApiPage).toHaveBeenCalledWith(
      '/academics/calendar/',
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.any(AbortSignal),
    ));
  });

  it('renders events from a paginated calendar response', async () => {
    const eventDate = new Date(new Date().getFullYear(), new Date().getMonth(), 15);
    const date = [
      eventDate.getFullYear(),
      String(eventDate.getMonth() + 1).padStart(2, '0'),
      String(eventDate.getDate()).padStart(2, '0'),
    ].join('-');
    const event: CalendarEvent = {
      id: 'class-1',
      kind: 'class',
      title: 'Systems lecture',
      unit_code: 'CS101',
      offering_id: 1,
      date,
      start_time: '10:00',
      end_time: '11:00',
      location: 'Room 2',
      due_at: null,
    };
    vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve(
      endpoint === '/academics/calendar/'
        ? { count: 1, next: null, previous: null, results: [event] }
        : { count: 0, next: null, previous: null, results: [] },
    ));

    render(<StudentDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: /1 activity/ }));
    expect(await screen.findByText('Systems lecture')).toBeInTheDocument();
  });
});
