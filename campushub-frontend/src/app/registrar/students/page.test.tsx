import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegistrarStudentsPage from '@/app/registrar/students/page';
import api from '@/lib/api';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Registrar student onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { results: [{
      id: 5,
      code: 'BSCIT',
      title: 'Bachelor of Science in IT',
      is_active: true,
      first_name: 'Directory',
      last_name: 'Learner',
      admission_number: 'STU-1000',
      email: 'directory@example.test',
      role: 'student',
    }] } });
    vi.mocked(api.post).mockResolvedValue({ data: { welcome_email_status: 'queued' } });
  });

  it('shows the searchable active student directory', async () => {
    render(<RegistrarStudentsPage />);

    expect(await screen.findAllByText('Directory Learner')).not.toHaveLength(0);
    expect(api.get).toHaveBeenCalledWith('/users/', expect.objectContaining({
      params: expect.objectContaining({ role: 'student' }),
    }));
    expect(screen.getByPlaceholderText('Search name, admission number, or email')).toBeInTheDocument();
  });

  it('creates a student account only after confirmation and requests a welcome email', async () => {
    render(<RegistrarStudentsPage />);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Riley' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Student' } });
    fireEvent.change(screen.getByLabelText('Student email'), { target: { value: 'riley@example.test' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'rstudent' } });
    fireEvent.change(screen.getByLabelText('Admission number'), { target: { value: 'STU-1001' } });
    await screen.findByRole('option', { name: 'BSCIT · Bachelor of Science in IT' });
    fireEvent.change(screen.getByLabelText('Admitted programme'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm admission and send login email' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/', {
      first_name: 'Riley',
      last_name: 'Student',
      email: 'riley@example.test',
      username: 'rstudent',
      admission_number: 'STU-1001',
      phone_number: '',
      course_id: 5,
      role: 'student',
      send_welcome_email: true,
    }));
    expect(await screen.findByText(/initial sign-in email has been sent/)).toBeInTheDocument();
  });
});
