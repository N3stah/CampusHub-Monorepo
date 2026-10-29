import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LecturerAttendancePage from '@/app/lecturer/attendance/page';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), put: vi.fn() },
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
  mocks.api.get.mockImplementation((endpoint: string) => {
    if (endpoint.endsWith('/sessions/')) {
      return Promise.resolve({ data: [{
        id: 8,
        offering_id: 3,
        unit_code: 'BIT01104',
        unit_title: 'Computer Applications',
        course_id: 1,
        course_code: 'BIT',
        course_title: 'Bachelors In Information Technology',
        day_of_week: 3,
        day_name: 'Thursday',
        start_time: '09:00',
        end_time: '10:00',
        starts_on: '2020-01-01',
        ends_on: '2035-12-31',
        location: 'Lab 1',
      }] });
    }
    return Promise.resolve({ data: {
      session: {},
      date: '2030-01-03',
      records: [{
        student_id: 21,
        student_name: 'Titus Kipkoech',
        admission_number: '23/08181',
        course_code: 'BIT',
        course_title: 'Bachelors In Information Technology',
        status: null,
        note: '',
      }],
    } });
  });
  mocks.api.put.mockResolvedValue({ data: {} });
});

describe('lecturer attendance page', () => {
  it('loads the class roster with registration details and attendance status', async () => {
    render(<LecturerAttendancePage />);
    expect(await screen.findByText('Titus Kipkoech')).toBeInTheDocument();
    expect(screen.getByText('23/08181')).toBeInTheDocument();
    expect(screen.getByLabelText('Attendance for Titus Kipkoech')).toHaveValue('');
  });

  it('saves attendance for marked students', async () => {
    render(<LecturerAttendancePage />);
    await screen.findByText('Titus Kipkoech');
    fireEvent.change(screen.getByLabelText('Attendance for Titus Kipkoech'), { target: { value: 'present' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }));

    await waitFor(() => expect(mocks.api.put).toHaveBeenCalledWith(
      expect.stringMatching('/academics/sessions/8/attendance/'),
      { records: [{ student_id: 21, status: 'present', note: '' }] },
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Attendance saved');
  });
});
