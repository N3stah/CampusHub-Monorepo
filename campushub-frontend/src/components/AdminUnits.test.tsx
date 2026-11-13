import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUnits from '@/components/AdminUnits';
import { getApiPage } from '@/lib/portal';
import type { Course } from '@/types/portal';

const mocks = vi.hoisted(() => ({
  getApiPage: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
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

const unit = {
  id: 1,
  code: 'CS101',
  title: 'Computing',
  credits: 3,
  description: '',
  is_active: true,
  departments: [{ id: 7, code: 'CS', name: 'Computer Science' }],
  offerings: [{
    offering_id: 11,
    course_id: 21,
    course_code: 'BSC',
    course_title: 'Bachelor of Computing',
    is_active: true,
    lecturers: [],
  }],
};

const courses: Course[] = [{
  id: 21,
  code: 'BSC',
  title: 'Bachelor of Computing',
  department_id: 7,
  credits: 3,
  description: '',
  is_active: true,
  lecturer_id: null,
}];

beforeEach(() => {
  vi.mocked(getApiPage).mockImplementation((endpoint: string) => Promise.resolve({
    count: 1,
    next: null,
    previous: null,
    results: endpoint === '/academics/units/' ? [unit]
      : endpoint === '/academics/departments/' ? [{
        id: 7,
        name: 'Computer Science',
        code: 'CS',
        school__name: 'Engineering',
      }]
        : endpoint === '/academics/courses/' ? courses
          : [],
  }));
});

describe('admin units', () => {
  it('opens legacy unit responses with selected department and programme checkboxes', async () => {
    render(<AdminUnits />);

    await screen.findByRole('button', { name: /CS101/ });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });
});