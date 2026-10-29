import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssignmentSubmissionsPanel from '@/components/AssignmentSubmissionsPanel';

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: mocks }));
vi.mock('@/lib/portal', () => ({
  getApiErrorMessage: (error: Error) => error.message,
}));

const assignment = {
  id: 8,
  offering_id: 3,
  unit_id: 2,
  unit_code: 'BIT01104',
  unit_title: 'Computer Applications',
  course_id: 1,
  course_code: 'BIT',
  course_title: 'Bachelor of Information Technology',
  title: 'Assignment 1',
  instructions: '',
  assignment_type: 'file' as const,
  allowed_file_types: ['pdf'],
  questions: [],
  due_at: '2030-01-01T12:00:00Z',
  max_points: 10,
  is_published: true,
  created_at: '2029-12-01T12:00:00Z',
  updated_at: '2029-12-01T12:00:00Z',
};

const results = Array.from({ length: 30 }, (_, index) => ({
  student_id: index + 1,
  student_name: `Student ${String(index + 1).padStart(2, '0')}`,
  admission_number: `BIT/2025/${String(index + 1).padStart(3, '0')}`,
  course_code: 'BIT',
  course_title: 'Bachelors In Information Technology',
  submission: index < 27 ? {
    id: index + 1,
    submitted_at: '2029-12-31T12:00:00Z',
    file_name: null,
    score: index < 5 ? '8.00' : null,
    feedback: '',
    graded_at: index < 5 ? '2029-12-31T13:00:00Z' : null,
  } : null,
  answers: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.patch.mockResolvedValue({ data: { submission: {
    id: 6,
    submitted_at: '2029-12-31T12:00:00Z',
    file_name: null,
    score: '7.00',
    feedback: '',
    graded_at: '2029-12-31T13:00:00Z',
    grade_released: false,
  } } });
  mocks.get.mockResolvedValue({
    data: {
      assignment_title: 'Assignment 1',
      max_points: 10,
      assignment_type: 'file',
      count: 30,
      submitted_count: 27,
      results,
    },
  });
});

describe('assignment submission lists', () => {
  it('opens the selected list, reports marks, and paginates large rosters', async () => {
    render(<AssignmentSubmissionsPanel assignment={assignment} />);

    const marked = await screen.findByRole('button', { name: /Marked 5/ });
    expect(marked).toHaveTextContent('of 27 submitted');
    fireEvent.click(marked);
    expect(await screen.findByText('Marked submissions')).toBeInTheDocument();
    expect(screen.getByText('5 students · showing 1–5')).toBeInTheDocument();
    expect(screen.getByText('Student 01')).toBeInTheDocument();
    expect(screen.queryByText('Student 06')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Registration number' })).toBeInTheDocument();
    expect(screen.getAllByText('BIT · Bachelors In Information Technology').length).toBeGreaterThan(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
    expect(screen.getByRole('region', { name: 'Submission details for Student 01' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mark / 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Submission details for Student 01' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Not marked 22/ }));
    expect(screen.getByText('Submitted, not marked')).toBeInTheDocument();
    expect(screen.getByText('22 students · showing 1–22')).toBeInTheDocument();
    expect(screen.getByText('Student 06')).toBeInTheDocument();
    expect(screen.queryByText('Student 01')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enrolled 30/ }));
    expect(screen.getByText('Enrolled students')).toBeInTheDocument();
    expect(screen.getByText('30 students · showing 1–25')).toBeInTheDocument();
    expect(screen.getByText('Student 25')).toBeInTheDocument();
    expect(screen.queryByText('Student 26')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Student 26')).toBeInTheDocument();

    const studentSearch = screen.getByRole('searchbox', { name: 'Search by name or registration number' });
    fireEvent.change(studentSearch, { target: { value: 'BIT/2025/030' } });
    const list = screen.getByRole('region', { name: 'Submissions' });
    expect(within(list).getByText('Student 30')).toBeInTheDocument();
    expect(within(list).queryByText('Student 01')).not.toBeInTheDocument();
  }, 10000);

  it('opens submitted and not-submitted lists independently', async () => {
    render(<AssignmentSubmissionsPanel assignment={assignment} />);

    fireEvent.click(await screen.findByRole('button', { name: /Submitted 27/ }));
    expect(screen.getByText('Submitted work')).toBeInTheDocument();
    expect(screen.getByText('27 students · showing 1–25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Not submitted 3/ }));
    expect(screen.getByText('Students who have not submitted')).toBeInTheDocument();
    expect(screen.getByText('3 students · showing 1–3')).toBeInTheDocument();
    expect(screen.getByText('Student 28')).toBeInTheDocument();
    expect(screen.queryByText('Student 01')).not.toBeInTheDocument();
  });

  it('can save a draft grade without releasing it to the student', async () => {
    render(<AssignmentSubmissionsPanel assignment={assignment} />);
    fireEvent.click(await screen.findByRole('button', { name: /Not marked 22/ }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'View' }))[0]);
    fireEvent.change(screen.getByLabelText('Mark / 10'), { target: { value: '7' } });
    fireEvent.click(screen.getByLabelText('Release to student'));
    fireEvent.click(screen.getByRole('button', { name: 'Award mark' }));

    fireEvent.click(await screen.findByRole('button', { name: /Marked 6/ }));
    expect(await screen.findByText('Draft mark · 7.00 / 10')).toBeInTheDocument();
    expect(mocks.patch).toHaveBeenCalledWith(
      '/academics/submissions/6/grade/',
      { score: '7', feedback: '', release: false },
    );
  });
});
