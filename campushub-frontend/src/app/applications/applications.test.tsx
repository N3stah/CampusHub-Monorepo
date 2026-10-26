import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationsPage from '@/app/applications/page';
import ApplicationReviewPanel from '@/components/ApplicationReviewPanel';
import ProfilePage from '@/app/profile/page';
import PlacementApplicationPage from '@/app/placements/[id]/apply/page';
import CourseDetailPage from '@/app/courses/[id]/page';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiPage } from '@/lib/portal';
import type { StudentApplication } from '@/types/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  pathname: vi.fn(() => '/applications'),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));

vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
  usePathname: () => mocks.pathname(),
  useParams: () => ({ id: '12' }),
}));

vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

const student = {
  id: 5,
  email: 'student@example.test',
  username: 'student',
  first_name: 'Taylor',
  last_name: 'Student',
  role: 'student' as const,
  department: null,
  gpa: null,
  is_active: true,
  date_joined: '2026-01-01',
};

const application: StudentApplication = {
  id: 23,
  status: 'pending',
  applied_at: '2026-10-01T09:00:00Z',
  cover_note: 'I am interested in this placement.',
  cv_file: null,
  student: { id: student.id, first_name: student.first_name, last_name: student.last_name, email: student.email },
  placement: { id: 12, title: 'Software Intern', company: 'Campus Systems' },
};

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: student,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  });
  vi.mocked(getApiPage).mockResolvedValue({ count: 1, next: null, previous: null, results: [application] });
  vi.mocked(api.get).mockResolvedValue({
    data: {
      first_name: student.first_name,
      last_name: student.last_name,
      phone_number: '',
      title: '',
      bio: '',
      office_hours: '',
    },
  });
  vi.mocked(api.patch).mockResolvedValue({ data: { ...student, first_name: 'Taylor Ann' } });
});

describe('student and staff workflows', () => {
  it('allows a student to withdraw a pending application and reflects the new status', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ApplicationsPage />);

    expect(await screen.findByText('Software Intern')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/applications/23/withdraw/'));
    expect(await screen.findByText('withdrawn')).toBeInTheDocument();
  });

  it('lets placement staff update an application status', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { ...student, role: 'officer' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    render(<ApplicationReviewPanel />);

    const statusSelect = await screen.findByLabelText('Update status for application 23');
    fireEvent.change(statusSelect, { target: { value: 'accepted' } });

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/applications/23/status/', { status: 'accepted' }));
  });

  it('submits the application form as multipart data with the selected CV', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        id: 12,
        title: 'Software Intern',
        company: 'Campus Systems',
        deadline: '2026-12-15',
        is_active: true,
      },
    });
    vi.mocked(api.post).mockResolvedValue({ data: { id: 77 } });
    render(<PlacementApplicationPage />);

    fireEvent.change(await screen.findByLabelText('Cover note'), {
      target: { value: 'I am excited to apply for this role.' },
    });
    const cv = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/CV/), { target: { files: [cv] } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/placements/12/apply/',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ));
    const submittedData = vi.mocked(api.post).mock.calls[0][1] as FormData;
    expect(submittedData.get('cover_note')).toBe('I am excited to apply for this role.');
    expect(submittedData.get('cv_file')).toBe(cv);
    expect(mocks.routerPush).toHaveBeenCalledWith('/applications/77');
  });

  it('loads and saves self-service profile fields using the authenticated profile endpoint', async () => {
    const updateUser = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: student,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser,
    });
    render(<ProfilePage />);

    const firstName = await screen.findByLabelText('First name');
    fireEvent.change(firstName, { target: { value: 'Taylor Ann' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/auth/me/', expect.objectContaining({
      first_name: 'Taylor Ann',
      last_name: 'Student',
    })));
    expect(updateUser).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Your profile was saved.');
  });

  it('shows the authorized lecturer course roster', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { ...student, role: 'lecturer' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        id: 12,
        code: 'CS101',
        title: 'Introduction to Computing',
        department_id: 1,
        lecturer_id: student.id,
        credits: 3,
        is_active: true,
        lecturer: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
        },
      },
    });
    vi.mocked(getApiPage).mockImplementation(async (endpoint) => ({
      count: endpoint.endsWith('/roster/') ? 1 : 0,
      next: null,
      previous: null,
      results: endpoint.endsWith('/roster/')
        ? [{
            id: 1,
            student_id: 18,
            student_name: 'Morgan Enrolled',
            student_email: 'morgan@example.test',
            status: 'active',
            enrolled_at: '2026-10-01T09:00:00Z',
          }]
        : [],
    }));

    render(<CourseDetailPage />);

    expect(await screen.findByText('Morgan Enrolled')).toBeInTheDocument();
    expect(screen.getByText('morgan@example.test')).toBeInTheDocument();
    expect(getApiPage).toHaveBeenCalledWith('/academics/courses/12/roster/', {}, expect.any(AbortSignal));
  });
});
