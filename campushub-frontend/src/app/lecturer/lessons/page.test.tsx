import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LecturerLessonsPage from '@/app/lecturer/lessons/page';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getApiPage: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', () => ({
  getApiPage: mocks.getApiPage,
  getApiErrorMessage: (error: Error) => error.message,
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 5, role: 'lecturer' } }),
}));
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const lesson = {
  id: 11,
  offering_id: 3,
  title: 'Lesson 1: Introduction',
  description: 'Introduction to the course.',
  scheduled_at: '2030-01-01T10:00:00Z',
  created_at: '2029-12-01T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApiPage).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [{
      id: 2,
      code: 'BIT01104',
      title: 'Computer Applications',
      credits: 3,
      description: '',
      is_active: true,
      department_ids: [],
      departments: [],
      course_ids: [1],
      offerings: [{
        offering_id: 3,
        course_id: 1,
        course_code: 'BIT',
        course_title: 'Bachelors In Information Technology',
        is_active: true,
        lecturers: [{ id: 5, name: 'Lecturer Example' }],
      }],
    }],
  });
  mocks.api.get.mockResolvedValue({ data: [lesson] });
  mocks.api.post.mockResolvedValue({ data: {} });
  mocks.api.patch.mockResolvedValue({ data: {} });
});

describe('lecturer lesson plan page', () => {
  it('shows scheduled lessons with their unit and date', async () => {
    render(<LecturerLessonsPage />);

    expect(await screen.findByText('Lesson 1: Introduction')).toBeInTheDocument();
    expect(screen.getByText('BIT01104 · BIT · Computer Applications')).toBeInTheDocument();
    expect(screen.getByText(new Date(lesson.scheduled_at).toLocaleString())).toBeInTheDocument();
  });

  it('schedules a lesson for a selected unit and shows confirmation', async () => {
    render(<LecturerLessonsPage />);
    await screen.findByText('Lesson 1: Introduction');
    fireEvent.change(screen.getByLabelText('Unit / course'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Lesson 2: Spreadsheets' } });
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2030-01-04T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule lesson' }));

    await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith(
      '/academics/offerings/3/lessons/',
      expect.objectContaining({ title: 'Lesson 2: Spreadsheets' }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Lesson scheduled for BIT01104.');
  });

  it('lets a lecturer edit a lesson and update its duration', async () => {
    render(<LecturerLessonsPage />);
    await screen.findByText('Lesson 1: Introduction');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Lesson title'), { target: { value: 'Lesson 1: Foundations' } });
    fireEvent.change(screen.getByLabelText('Duration (minutes)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mocks.api.patch).toHaveBeenCalledWith(
      '/academics/lessons/11/',
      expect.objectContaining({ title: 'Lesson 1: Foundations', duration_minutes: 90 }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Lesson updated');
  });
});
