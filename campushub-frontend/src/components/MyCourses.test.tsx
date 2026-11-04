import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyCourses from '@/components/MyCourses';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({ getApiPage: vi.fn() }));

vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: mocks.getApiPage };
});
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

beforeEach(() => {
  vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve(
    endpoint === '/academics/enrollments/'
      ? {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, course_id: 2, course_code: 'DIT', course_title: 'Diploma in IT', status: 'active', enrolled_at: '2026-01-01' },
          { id: 2, course_id: 3, course_code: 'BSC', course_title: 'Computing', status: 'dropped', enrolled_at: '2025-01-01' },
        ],
      }
      : {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
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
              lecturers: [{ id: 8, name: 'Taylor Lecturer' }],
            }],
          },
          {
            id: 42,
            code: 'DB101',
            title: 'Database Systems',
            credits: 3,
            description: '',
            is_active: true,
            department_ids: [1],
            departments: [],
            course_ids: [3],
            offerings: [{
              offering_id: 52,
              course_id: 3,
              course_code: 'BSC',
              course_title: 'Computing',
              is_active: true,
              lecturers: [],
            }],
          },
        ],
      },
  ));
});

describe('my units', () => {
  it('lists only units in active programmes and links to the selected unit', async () => {
    render(<MyCourses />);

    expect(await screen.findByText('Artificial Intelligence')).toBeInTheDocument();
    expect(screen.queryByText('Database Systems')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI101.*Artificial Intelligence.*Open unit/ }))
      .toHaveAttribute('href', '/courses/2#unit-41');
  });
});