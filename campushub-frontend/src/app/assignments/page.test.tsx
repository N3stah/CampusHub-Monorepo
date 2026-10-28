import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssignmentsPage from '@/app/assignments/page';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'student' } }),
}));
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
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
});
