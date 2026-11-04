import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CourseDetailPage from '@/app/courses/[id]/page';
import api from '@/lib/api';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getApiPage: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 8, role: 'student' } }),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '2' }) }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const units = [{
  id: 41,
  code: 'AI101',
  title: 'Artificial Intelligence',
  credits: 3,
  description: '',
  is_active: true,
  department_ids: [1],
  departments: [],
  course_ids: [2],
  offerings: [{
    offering_id: 51,
    course_id: 2,
    course_code: 'DIT',
    course_title: 'Diploma in IT',
    is_active: true,
    lecturers: [{ id: 12, name: 'Taylor Lecturer' }],
  }],
}];

beforeEach(() => {
  window.history.replaceState(null, '', '/courses/2#unit-41');
  vi.mocked(api.get).mockResolvedValue({
    data: {
      id: 2,
      code: 'DIT',
      title: 'Diploma in IT',
      department_id: 1,
      lecturer_id: null,
      credits: 60,
      description: '',
      is_active: true,
      units: [],
    },
  });
  vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve(
    endpoint === '/academics/units/'
      ? { count: 1, next: null, previous: null, results: units }
      : { count: 0, next: null, previous: null, results: [] },
  ));
});

describe('student course unit navigation', () => {
  it('shows only the requested unit as the page title and loads its contents', async () => {
    render(<CourseDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Artificial Intelligence', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course units' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Diploma in IT' })).not.toBeInTheDocument();
    expect(await screen.findByText('No unit activities have been posted yet.')).toBeInTheDocument();
  });

  it('keeps resources and updates unit-scoped and collapses assignments to the next due item', async () => {
    vi.mocked(getApiPage).mockImplementation((endpoint: string) => {
      if (endpoint === '/academics/units/') {
        return Promise.resolve({ count: 1, next: null, previous: null, results: units });
      }
      if (endpoint.endsWith('/assignments/')) {
        return Promise.resolve({
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              id: 1,
              offering_id: 51,
              title: 'CAT 1',
              instructions: 'Complete CAT 1',
              assignment_type: 'file',
              allowed_file_types: ['pdf'],
              questions: [],
              due_at: '2030-01-02T10:00:00Z',
              max_points: 10,
              is_published: true,
              created_at: '2029-12-01T10:00:00Z',
            },
            {
              id: 2,
              offering_id: 51,
              title: 'Assignment 2',
              instructions: 'Complete assignment 2',
              assignment_type: 'file',
              allowed_file_types: ['pdf'],
              questions: [],
              due_at: '2030-01-03T10:00:00Z',
              max_points: 20,
              is_published: true,
              created_at: '2029-12-02T10:00:00Z',
            },
          ],
        });
      }
      if (endpoint === '/resources/offerings/51/resources/') {
        return Promise.resolve({
          count: 1,
          next: null,
          previous: null,
          results: [{
            id: 9,
            title: 'Discrete math notes',
            description: 'Week one notes',
            file_type: 'pdf',
            file_size: 1_048_576,
            file_url: 'https://example.test/discrete-math.pdf',
            uploaded_by: 'Lecturer L',
            created_at: '2026-10-29T10:00:00Z',
          }],
        });
      }
      if (endpoint === '/resources/offerings/51/announcements/') {
        return Promise.resolve({
          count: 1,
          next: null,
          previous: null,
          results: [{
            id: 4,
            title: 'Unit CAT notice',
            body: 'CAT is on Thursday.',
            author: 'Lecturer L',
            created_at: '2026-10-28T10:00:00Z',
          }],
        });
      }
      if (endpoint === '/academics/offerings/51/groups/') {
        return Promise.resolve({
          count: 1,
          next: null,
          previous: null,
          results: [{
            id: 7,
            name: 'A',
            members: [{
              id: 8,
              first_name: 'Titus',
              last_name: 'Kipkoech',
              admission_number: '24/0845',
              phone_number: '+254700000000',
              programme_code: 'DIT',
              programme_title: 'Diploma in IT',
            }],
          }],
        });
      }
      if (endpoint === '/resources/courses/2/resources/') {
        return Promise.resolve({ count: 1, next: null, previous: null, results: [{ id: 10, title: 'Duplicate programme file' }] });
      }
      if (endpoint === '/resources/courses/2/announcements/') {
        return Promise.resolve({ count: 1, next: null, previous: null, results: [{ id: 5, title: 'Programme-wide update', body: 'Not for this unit.', created_at: '2026-10-28T10:00:00Z' }] });
      }
      return Promise.resolve({ count: 0, next: null, previous: null, results: [] });
    });

    render(<CourseDetailPage />);

    expect(await screen.findByText('CAT 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CAT 1' })).toHaveAttribute('href', '/assignments#assignment-1');
    expect(screen.queryByText('Assignment 2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See all 2 assignments' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Course resources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lecturer updates' })).not.toBeInTheDocument();
    expect(screen.queryByText('Duplicate programme file')).not.toBeInTheDocument();
    expect(screen.getByText('Unit CAT notice')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See all 2 assignments' }));
    expect(await screen.findByText('Assignment 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Discrete math notes/ }));
    expect(await screen.findByText('Week one notes')).toBeInTheDocument();
    expect(screen.getAllByText(/Lecturer L/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open file' })).toHaveAttribute('href', 'https://example.test/discrete-math.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'View Titus Kipkoech profile' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('24/0845');
    expect(screen.getByRole('dialog')).toHaveTextContent('+254700000000');
    expect(screen.getByRole('dialog')).toHaveTextContent('DIT · Diploma in IT');
  });
});