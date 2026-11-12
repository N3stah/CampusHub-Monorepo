import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminCampusStats from '@/components/AdminCampusStats';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      active_users: 5,
      students: 1,
      lecturers: 2,
      placement_officers: 1,
      schools: 1,
      departments: 1,
      courses: 1,
      units: 1,
      active_enrollments: 1,
      placements: 1,
      applications: 1,
      open_placements: 1,
      pending_applications: 1,
    },
  });
});

describe('admin campus stats', () => {
  it('displays the role and campus totals returned by the API', async () => {
    render(<AdminCampusStats />);

    expect(await screen.findByText('Students')).toBeInTheDocument();
    expect(screen.getByText('Active student accounts').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Active lecturer accounts').previousElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Active officer accounts').previousElementSibling).toHaveTextContent('1');
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('opens a searchable, paginated directory from a stat card', async () => {
    vi.mocked(api.get).mockImplementation(async (endpoint) => {
      if (endpoint === '/admin/stats/') {
        return {
          data: {
            active_users: 5,
            students: 1,
            lecturers: 2,
            placement_officers: 1,
            schools: 1,
            departments: 1,
            courses: 1,
            units: 1,
            active_enrollments: 1,
            placements: 1,
            open_placements: 1,
            applications: 1,
            pending_applications: 1,
          },
        };
      }
      if (endpoint === '/admin/stats/directory/students/') {
        return {
          data: {
            count: 1,
            next: null,
            previous: null,
            results: [{
              id: 21,
              name: 'Ada Student',
              subtitle: 'Student · Computing · ada@example.test',
              category: 'Student',
              status: 'Active',
            }],
          },
        };
      }
      throw new Error(`Unexpected GET ${String(endpoint)}`);
    });

    render(<AdminCampusStats />);
    fireEvent.click((await screen.findByText('Active student accounts')).closest('button')!);

    expect(await screen.findByRole('dialog', { name: 'Students' })).toBeInTheDocument();
    expect(await screen.findByText('Ada Student')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/admin/stats/directory/students/',
      expect.objectContaining({ params: expect.objectContaining({ search: 'Ada', account_status: 'active' }) }),
    ));
  });
});
