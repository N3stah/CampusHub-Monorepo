import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LecturerUnitPage from '@/app/lecturer/units/[offeringId]/page';
import api from '@/lib/api';
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
vi.mock('next/navigation', () => ({
  useParams: () => ({ offeringId: '4' }),
  useSearchParams: () => new URLSearchParams('?tab=groups'),
}));
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getApiPage).mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  vi.mocked(api.get).mockImplementation((endpoint: string) => Promise.resolve({
    data: endpoint === '/academics/offerings/4/'
      ? {
        id: 4,
        offering_id: 4,
        unit_id: 2,
        unit_code: 'CS101U',
        unit_title: 'Computer Science',
        unit_description: '',
        credits: 3,
        course_id: 8,
        course_code: 'CS101',
        course_title: 'Computing',
        department_name: 'Computer Science',
        school_name: 'Engineering',
      }
      : { count: 0, results: [] },
  }));
});

describe('lecturer unit page', () => {
  it('handles an empty paginated groups response', async () => {
    render(<LecturerUnitPage />);

    expect(await screen.findByText('No groups have been generated for this unit.')).toBeInTheDocument();
  });
});