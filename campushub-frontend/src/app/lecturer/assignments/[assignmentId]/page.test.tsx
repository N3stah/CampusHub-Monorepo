import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LecturerAssignmentPage from '@/app/lecturer/assignments/[assignmentId]/page';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  replace: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', () => ({
  getApiErrorMessage: (error: Error) => error.message,
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ assignmentId: '8' }),
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
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
  instructions: 'Complete and submit the practical exercise.',
  assignment_type: 'quiz' as const,
  allowed_file_types: [],
  questions: [{
    id: 11,
    prompt: 'Which application is used for spreadsheets?',
    options: ['Word', 'Excel'],
    correct_option: 1,
  }],
  due_at: '2030-01-01T12:00:00Z',
  max_points: 10,
  is_published: true,
  created_at: '2029-12-01T12:00:00Z',
  updated_at: '2029-12-01T12:00:00Z',
};
const submissions = {
  assignment_title: 'Assignment 1',
  max_points: 10,
  assignment_type: 'quiz' as const,
  count: 2,
  submitted_count: 1,
  results: [
    {
      student_id: 21,
      student_name: 'Ada Student',
      admission_number: 'BIT/2025/001',
      course_code: 'BIT',
      submission: { id: 44, submitted_at: '2029-12-31T12:00:00Z', file_name: null, score: null, feedback: '', graded_at: null },
      answers: { '11': 1 },
    },
    {
      student_id: 22,
      student_name: 'Grace Student',
      admission_number: 'BIT/2025/002',
      course_code: 'BIT',
      submission: null,
      answers: {},
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.get.mockImplementation((path: string) => Promise.resolve({
    data: path.endsWith('/submissions/') ? submissions : assignment,
  }));
});

describe('lecturer assignment detail page', () => {
  it('shows a concise summary, edit action, and inline submission management', async () => {
    render(<LecturerAssignmentPage />);

    expect(await screen.findByRole('heading', { name: 'Assignment 1' })).toBeInTheDocument();
    expect(screen.queryByText('Complete and submit the practical exercise.')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Not submitted 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Submitted 1/ }));
    expect(await screen.findByText('Ada Student')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'See submissions' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit assignment' }));
    expect(screen.getByText('Complete and submit the practical exercise.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete assignment' })).toBeInTheDocument();
  });

  it('saves edited assignment details', async () => {
    mocks.api.patch.mockResolvedValue({
      data: { ...assignment, title: 'Updated assignment title' },
    });
    render(<LecturerAssignmentPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit assignment' }));
    const titleInput = await screen.findByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Updated assignment title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mocks.api.patch).toHaveBeenCalledWith(
      '/academics/assignments/8/',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ));
    expect(mocks.api.patch.mock.calls[0][1].get('title')).toBe('Updated assignment title');
    expect(mocks.api.patch.mock.calls[0][1].get('is_published')).toBe('true');
    expect(await screen.findByRole('status')).toHaveTextContent('Assignment changes saved.');
  });

  it('supports uploading a lecturer-provided PDF document', async () => {
    mocks.api.patch.mockResolvedValue({
      data: { ...assignment, attachment_name: 'assignment.pdf' },
    });
    render(<LecturerAssignmentPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit assignment' }));
    const file = new File(['%PDF-1.4'], 'assignment.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Assignment document/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.api.patch).toHaveBeenCalled());
    expect(mocks.api.patch.mock.calls[0][1].get('attachment')).toBe(file);
  });

  it('deletes an assignment and returns to the assignment list', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    mocks.api.delete.mockResolvedValue({ data: { message: 'Assignment deleted.' } });
    render(<LecturerAssignmentPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit assignment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete assignment' }));

    await waitFor(() => expect(mocks.api.delete).toHaveBeenCalledWith('/academics/assignments/8/'));
    expect(mocks.replace).toHaveBeenCalledWith('/assignments');
    vi.unstubAllGlobals();
  });
});
