import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LecturerDashboard from '@/components/LecturerDashboard';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiPage } from '@/lib/portal';
import type { AcademicUnit, CalendarEvent } from '@/types/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  pathname: vi.fn(() => '/dashboard'),
}));

vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
  usePathname: () => mocks.pathname(),
}));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

const lecturer = {
  id: 8,
  email: 'lecturer@example.test',
  username: 'lecturer',
  first_name: 'Taylor',
  last_name: 'Lecturer',
  role: 'lecturer' as const,
  department: null,
  gpa: null,
  is_active: true,
  date_joined: '2026-01-01',
};

const units: AcademicUnit[] = [
  {
    id: 21,
    code: 'AI101',
    title: 'Artificial Intelligence',
    credits: 3,
    description: '',
    is_active: true,
    department_ids: [1],
    departments: [],
    course_ids: [5],
    offerings: [{
      offering_id: 31,
      course_id: 5,
      course_code: 'BSC',
      course_title: 'Bachelor of Computing',
      is_active: true,
      lecturers: [{ id: lecturer.id, name: 'Taylor Lecturer' }],
    }],
  },
  {
    id: 22,
    code: 'NET101',
    title: 'Computer Networks',
    credits: 3,
    description: '',
    is_active: true,
    department_ids: [1],
    departments: [],
    course_ids: [5],
    offerings: [{
      offering_id: 32,
      course_id: 5,
      course_code: 'BSC',
      course_title: 'Bachelor of Computing',
      is_active: true,
      lecturers: [{ id: 9, name: 'Other Lecturer' }],
    }],
  },
];

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: lecturer,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  });
  vi.mocked(getApiPage).mockResolvedValue({ count: units.length, next: null, previous: null, results: units });
  vi.mocked(api.get).mockImplementation((endpoint: string) => Promise.resolve({
    data: endpoint === '/academics/lecturer/summary/'
      ? {
        unit_count: 1,
        upcoming_lesson_count: 0,
        upcoming_assignment_count: 0,
        unmarked_submission_count: 0,
        pending_assignments: [],
        upcoming_dates: [],
      }
      : [] satisfies CalendarEvent[],
  }));
});

describe('lecturer overview', () => {
  it('shows only assigned units and keeps programme names off the overview', async () => {
    render(<LecturerDashboard />);

    expect(await screen.findByText('Artificial Intelligence')).toBeInTheDocument();
    expect(screen.queryByText('Computer Networks')).not.toBeInTheDocument();
    expect(screen.queryByText('Bachelor of Computing')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI101 Artificial Intelligence Open unit/ })).toHaveAttribute('href', '/lecturer/units/31');
    expect(await screen.findByText('Teaching at a glance')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take attendance' })).toHaveAttribute('href', '/lecturer/attendance');
  });

  it('shows a navigable monthly calendar and opens activities for the selected day', async () => {
    const now = new Date();
    const eventDate = new Date(now.getFullYear(), now.getMonth(), 15);
    const eventDateValue = [
      eventDate.getFullYear(),
      String(eventDate.getMonth() + 1).padStart(2, '0'),
      String(eventDate.getDate()).padStart(2, '0'),
    ].join('-');
    const event: CalendarEvent = {
      id: 'class-1',
      kind: 'class',
      title: 'AI seminar',
      unit_code: 'AI101',
      offering_id: 31,
      date: eventDateValue,
      start_time: '10:00',
      end_time: '11:00',
      location: 'Lab 2',
      due_at: null,
    };
    vi.mocked(api.get).mockImplementation((endpoint: string) => Promise.resolve({
      data: endpoint === '/academics/lecturer/summary/'
        ? {
          unit_count: 1,
          upcoming_lesson_count: 0,
          upcoming_assignment_count: 0,
          unmarked_submission_count: 0,
          pending_assignments: [],
          upcoming_dates: [],
        }
        : [event],
    }));
    render(<LecturerDashboard />);

    const activityDay = await screen.findByRole('button', { name: /1 activity/ });
    fireEvent.click(activityDay);
    expect(await screen.findByText('AI seminar')).toBeInTheDocument();
    expect(screen.getByText('Lab 2')).toBeInTheDocument();

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthLabel = nextMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('heading', { name: nextMonthLabel })).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/academics/calendar/',
      expect.objectContaining({
        params: {
          from: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`,
          to: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()).padStart(2, '0')}`,
        },
        signal: expect.any(AbortSignal),
      }),
    ));
  });
});
