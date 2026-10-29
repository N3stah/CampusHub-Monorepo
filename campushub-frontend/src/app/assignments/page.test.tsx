import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssignmentsPage from '@/app/assignments/page';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn(), post: vi.fn() },
  role: 'student' as 'student' | 'lecturer',
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 5, role: mocks.role } }),
}));
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const assignment = {
  id: 8,
  offering_id: 3,
  unit_id: 2,
  unit_code: 'AI101',
  unit_title: 'Artificial Intelligence',
  course_id: 1,
  course_code: 'BCS',
  course_title: 'Computing',
  title: 'Model evaluation',
  instructions: 'Upload your finished work.',
  assignment_type: 'file' as const,
  allowed_file_types: ['pdf'],
  questions: [],
  due_at: '2030-01-01T12:00:00Z',
  max_points: 20,
  is_published: true,
  created_at: '2029-12-01T12:00:00Z',
  updated_at: '2029-12-01T12:00:00Z',
};

beforeEach(() => {
  mocks.role = 'student';
  vi.mocked(mocks.api.get).mockReset();
  vi.mocked(getApiPage).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [assignment],
  });
});

describe('assignment submission timing', () => {
  it.each([
    ['2030-01-01T10:30:00Z', 'Submitted early by 1h 30m'],
    ['2030-01-01T13:15:00Z', 'Submitted late by 1h 15m'],
  ])('shows the correct timing for a submission at %s', async (submittedAt, expected) => {
    vi.mocked(mocks.api.get).mockResolvedValue({
      data: {
        submission: {
          id: 4,
          submitted_at: submittedAt,
          file_name: null,
          score: null,
        },
      },
    });

    render(<AssignmentsPage />);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('shows marks and feedback awarded by the lecturer', async () => {
    vi.mocked(mocks.api.get).mockResolvedValue({
      data: {
        submission: {
          id: 4,
          submitted_at: '2030-01-01T10:30:00Z',
          file_name: null,
          score: '18.50',
          feedback: 'Clear analysis and good references.',
          graded_at: '2030-01-02T10:30:00Z',
        },
      },
    });

    render(<AssignmentsPage />);

    expect(await screen.findByText('Score: 18.50 / 20')).toBeInTheDocument();
    expect(screen.getByText('Clear analysis and good references.')).toBeInTheDocument();
  });

  it('opens a dedicated assignment detail page from the lecturer assignment list', async () => {
    mocks.role = 'lecturer';
    const lecturerAssignment = {
      ...assignment,
      title: 'Assignment 1',
      unit_code: 'BIT01104',
      course_code: 'BIT',
      unit_title: 'Computer Applications',
      instructions: 'Complete and submit the practical exercise.',
    };
    vi.mocked(getApiPage).mockImplementation(async (endpoint) => endpoint === '/academics/units/'
      ? {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 2,
          code: 'BIT01104',
          title: 'Computer Applications',
          offerings: [{
            offering_id: 3,
            course_code: 'BIT',
            lecturers: [{ id: 5, name: 'Lecturer Example' }],
          }],
        }],
      } as never
      : {
        count: 1,
        next: null,
        previous: null,
        results: [lecturerAssignment],
      });

    render(<AssignmentsPage />);

    const assignmentCard = await screen.findByRole('link', { name: 'Open Assignment 1' });
    expect(assignmentCard).toHaveTextContent('BIT01104 · BIT');
    expect(assignmentCard).toHaveAttribute('href', '/lecturer/assignments/8');
    expect(screen.queryByText('Complete and submit the practical exercise.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle assignment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /manage assignment/i })).not.toBeInTheDocument();
  });
});
