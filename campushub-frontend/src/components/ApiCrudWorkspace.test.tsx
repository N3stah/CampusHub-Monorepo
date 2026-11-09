import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiCrudWorkspace from '@/components/ApiCrudWorkspace';
import { getApiPage } from '@/lib/portal';

const mocks = vi.hoisted(() => ({
  api: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/lib/portal', async () => {
  const actual = await vi.importActual<typeof import('@/lib/portal')>('@/lib/portal');
  return { ...actual, getApiPage: vi.fn() };
});

describe('API CRUD workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiPage).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 8, title: 'Intro to networks', amount: 1250 }],
    });
  });

  it('loads records and posts a new record using the configured endpoint', async () => {
    render(
      <ApiCrudWorkspace
        title="Books"
        description="Manage books."
        endpoint="/library/books/"
        fields={[
          { name: 'title', label: 'Title', required: true },
          { name: 'amount', label: 'Amount', type: 'number', required: true },
        ]}
        displayFields={['title', 'amount']}
      />,
    );

    expect((await screen.findAllByText('Intro to networks')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Add book' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Campus handbook' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '499.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith('/library/books/', {
      title: 'Campus handbook',
      amount: 499.5,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Books record created.');
  });

  it('patches an existing record and sends DELETE only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <ApiCrudWorkspace
        title="Books"
        description="Manage books."
        endpoint="/library/books/"
        fields={[{ name: 'title', label: 'Title', required: true }]}
        displayFields={['title']}
      />,
    );

    expect((await screen.findAllByText('Intro to networks')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Network systems' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.api.patch).toHaveBeenCalledWith('/library/books/8/', { title: 'Network systems' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(mocks.api.delete).toHaveBeenCalledWith('/library/books/8/'));
    expect(confirm).toHaveBeenCalled();
  });

  it('sends search and filter controls as server-side list parameters', async () => {
    render(
      <ApiCrudWorkspace
        title="Books"
        description="Manage books."
        endpoint="/library/books/"
        fields={[]}
        displayFields={['title']}
        filters={[{ name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }] }]}
        sortableFields={[{ value: 'title', label: 'Title' }]}
      />,
    );

    await screen.findAllByText('Intro to networks');
    fireEvent.change(screen.getByLabelText('Search Books'), { target: { value: 'network' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });

    await waitFor(() => {
      expect(getApiPage).toHaveBeenLastCalledWith(
        '/library/books/',
        expect.objectContaining({ page: 1, page_size: 25, search: 'network', status: 'active' }),
        expect.any(AbortSignal),
      );
    });
  });
});
