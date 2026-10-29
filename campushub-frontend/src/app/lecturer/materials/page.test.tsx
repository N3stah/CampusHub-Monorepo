import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LecturerMaterialsPage from '@/app/lecturer/materials/page';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
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
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('a', { href, ...props }, children),
  };
});

const lesson = {
  id: 11,
  offering_id: 3,
  title: 'Lesson 1: Introduction',
  description: '',
  scheduled_at: '2030-01-01T10:00:00Z',
  created_at: '2029-12-01T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApiPage).mockImplementation(async (endpoint: string) => {
    if (endpoint === '/academics/units/') {
      return {
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
      };
    }
    return { count: 0, next: null, previous: null, results: [] };
  });
  mocks.api.get.mockResolvedValue({ data: [lesson] });
  mocks.api.post.mockResolvedValue({ data: {} });
});

describe('lecturer materials management page', () => {
  it('uploads material to a selected unit and shows a success toast', async () => {
    render(<LecturerMaterialsPage />);

    await screen.findByRole('heading', { name: 'Add learning material' });
    expect(screen.getByLabelText('Select unit for material')).toHaveValue('3');
    fireEvent.change(screen.getByLabelText('Lesson'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Week 1 notes' } });
    const file = new File(['notes'], 'week-one.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload to students' }));

    await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith(
      '/resources/offerings/3/resources/',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ));
    expect(mocks.api.post.mock.calls[0][1].get('title')).toBe('Week 1 notes');
    expect(mocks.api.post.mock.calls[0][1].get('lesson_id')).toBe('11');
    expect(await screen.findByRole('status')).toHaveTextContent('Notes uploaded to BIT01104.');
  });

  it('shows upload validation errors as an alert toast', async () => {
    render(<LecturerMaterialsPage />);
    await screen.findByRole('heading', { name: 'Add learning material' });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No file attached' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload to students' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Select a unit, enter a title, and choose a file.');
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it('keeps existing lessons available when attaching material', async () => {
    render(<LecturerMaterialsPage />);
    await screen.findByRole('heading', { name: 'Add learning material' });
    expect(screen.getByLabelText('Lesson')).toHaveTextContent('Lesson 1: Introduction');
    expect(screen.queryByRole('heading', { name: 'Plan a lesson' })).not.toBeInTheDocument();
    expect(mocks.api.post).not.toHaveBeenCalledWith(
      '/academics/offerings/3/lessons/',
      expect.anything(),
    );
  });
});
