import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DirectoryPage from '@/components/DirectoryPage';
import { getApiPage } from '@/lib/portal';

vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: vi.fn() };
});

interface DirectoryEntry {
  id: number;
  name: string;
}

const columns = [{ label: 'Name', render: (item: DirectoryEntry) => item.name }];

describe('directory pagination and responsive lists', () => {
  it('paginates a complete, unpaginated API result locally', async () => {
    const records = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, name: `Student ${index + 1}` }));
    vi.mocked(getApiPage).mockResolvedValue({ count: records.length, next: null, previous: null, results: records });
    render(
      <DirectoryPage
        title="Students"
        description="Student directory"
        endpoint="/users/"
        searchPlaceholder="Search"
        columns={columns}
        getKey={(item: DirectoryEntry) => item.id}
        emptyMessage="No students"
      />,
    );

    expect((await screen.findAllByText('Student 1')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findAllByText('Student 21')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Student 1')).toHaveLength(0);
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('uses numbered pagination metadata returned by the API', async () => {
    vi.mocked(getApiPage)
      .mockResolvedValueOnce({
        count: 40,
        next: 2,
        previous: null,
        results: [{ id: 1, name: 'Page one' }],
      })
      .mockResolvedValueOnce({
        count: 40,
        next: null,
        previous: 1,
        results: [{ id: 2, name: 'Page two' }],
      });
    render(
      <DirectoryPage
        title="Students"
        description="Student directory"
        endpoint="/users/"
        searchPlaceholder="Search"
        columns={columns}
        getKey={(item: DirectoryEntry) => item.id}
        emptyMessage="No students"
      />,
    );

    expect((await screen.findAllByText('Page one')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(getApiPage).toHaveBeenLastCalledWith(
      '/users/',
      { page: 2, page_size: 20 },
      expect.any(AbortSignal),
    ));
    expect((await screen.findAllByText('Page two')).length).toBeGreaterThan(0);
  });
});
