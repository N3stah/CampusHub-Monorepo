import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssignmentsPage from '@/app/assignments/page';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

const unitPage = {
  count: 1,
  next: null,
  previous: null,
  results: [{
    id: 2,
    code: 'AI101',
    title: 'Artificial Intelligence',
    credits: 3,
    description: '',
    is_active: true,
    department_ids: [1],
    departments: [],
    course_ids: [1],
    offerings: [{
      offering_id: 3,
      course_id: 1,
      course_code: 'BCS',
      course_title: 'Computing',
      is_active: true,
      lecturers: [{ id: 5, name: 'Lecturer Example' }],
    }],
  }],
};

beforeEach(() => {
  mocks.role = 'student';
  window.history.replaceState(null, '', '/assignments');
  vi.mocked(mocks.api.get).mockReset();
  vi.mocked(mocks.api.patch).mockReset();
  vi.mocked(mocks.api.delete).mockReset();
  vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve(
    endpoint === '/academics/units/' ? unitPage : {
      count: 1,
      next: null,
      previous: null,
      results: [assignment],
    },
  ));
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

    fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.getByText('Posted 12/1/2029')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open unit →' })).toHaveAttribute('href', '/courses/1#unit-2');
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

    fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
    expect(await screen.findByText('Score: 18.50 / 20')).toBeInTheDocument();
    expect(screen.getByText('Clear analysis and good references.')).toBeInTheDocument();
  });

  it('scrolls to the assignment selected by its hash link', async () => {
    const scrollIntoView = vi.fn();
    vi.mocked(mocks.api.get).mockResolvedValue({ data: { submission: null } });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
    });
    window.history.replaceState(null, '', '/assignments#assignment-8');

    render(<AssignmentsPage />);

    expect(await screen.findByRole('heading', { name: 'Model evaluation' })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' }));
  });

  it('lets a student edit quiz answers and delete an existing submission', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const quizAssignment = {
      ...assignment,
      assignment_type: 'quiz' as const,
      questions: [{ id: 15, prompt: 'Correct answer?', options: ['No', 'Yes'] }],
    };
    vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve(
      endpoint === '/academics/units/' ? unitPage : {
        count: 1,
        next: null,
        previous: null,
        results: [quizAssignment],
      },
    ));
    vi.mocked(mocks.api.get).mockResolvedValue({
      data: {
        submission: {
          id: 44,
          submitted_at: '2030-01-01T10:30:00Z',
          file_name: null,
          score: '0.00',
          feedback: null,
          graded_at: '2030-01-01T10:30:00Z',
          grade_released: true,
          answers: { '15': 0 },
        },
      },
    });
    vi.mocked(mocks.api.patch).mockResolvedValue({
      data: {
        submission: {
          id: 44,
          submitted_at: '2030-01-01T10:30:00Z',
          file_name: null,
          score: '20.00',
          feedback: null,
          graded_at: '2030-01-01T10:31:00Z',
          grade_released: true,
          answers: { '15': 1 },
        },
      },
    });
    vi.mocked(mocks.api.delete).mockResolvedValue({ data: { message: 'Submission deleted' } });
    render(<AssignmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit submission' }));
    fireEvent.click(screen.getByLabelText('Yes'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mocks.api.patch).toHaveBeenCalledWith(
      '/academics/assignments/8/submission/',
      { answers: { '15': 1 } },
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Your submission has been updated.');

    fireEvent.click(screen.getByRole('button', { name: 'Delete submission' }));
    await waitFor(() => expect(mocks.api.delete).toHaveBeenCalledWith('/academics/assignments/8/submission/'));
    expect(await screen.findByRole('status')).toHaveTextContent('Your submission was deleted.');
    vi.unstubAllGlobals();
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
        ...unitPage,
        results: [{
          ...unitPage.results[0],
          code: 'BIT01104',
          title: 'Computer Applications',
          offerings: [{
            ...unitPage.results[0].offerings[0],
            course_code: 'BIT',
            course_title: 'Bachelors In Information Technology',
            lecturers: [{ id: 5, name: 'Lecturer Example' }],
          }],
        }],
      }
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
    fireEvent.click(screen.getByRole('button', { name: /BIT01104.*Computer Applications/ }));
    expect(screen.getByRole('link', { name: 'Add assignment' }))
      .toHaveAttribute('href', '/assignments/new/3');
    expect(screen.queryByText('Complete and submit the practical exercise.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle assignment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /manage assignment/i })).not.toBeInTheDocument();
  });

  it('links an empty unit assignment filter to that unit creation form', async () => {
    mocks.role = 'lecturer';
    vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve(
      endpoint === '/academics/units/' ? unitPage : {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    ));

    render(<AssignmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /AI101.*Artificial Intelligence/ }));
    expect(await screen.findByText('No assignments have been added to Artificial Intelligence yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add assignment for Artificial Intelligence' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add assignment' })[0])
      .toHaveAttribute('href', '/assignments/new/3');
  });
});
