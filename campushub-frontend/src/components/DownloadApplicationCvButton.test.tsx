import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DownloadApplicationCvButton from '@/components/DownloadApplicationCvButton';
import api from '@/lib/api';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  downloadBlob: vi.fn(),
  getDownloadFilename: vi.fn(() => 'candidate-cv.pdf'),
}));

vi.mock('@/lib/api', () => ({
  default: { get: mocks.get, defaults: { baseURL: 'http://localhost:8000/api' } },
}));

vi.mock('@/lib/application-files', async () => {
  const actual = await vi.importActual<typeof import('@/lib/application-files')>('@/lib/application-files');
  return {
    ...actual,
    downloadBlob: mocks.downloadBlob,
    getDownloadFilename: mocks.getDownloadFilename,
  };
});

describe('application CV download control', () => {
  it('fetches the CV through the authenticated API client and triggers a file download', async () => {
    const blob = new Blob(['CV data']);
    vi.mocked(api.get).mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="candidate-cv.pdf"' },
    });
    render(<DownloadApplicationCvButton applicationId={23} cvUrl="/media/cvs/candidate.pdf" />);

    fireEvent.click(screen.getByRole('button', { name: 'Download CV' }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      'http://localhost:8000/media/cvs/candidate.pdf',
      { responseType: 'blob' },
    ));
    expect(mocks.downloadBlob).toHaveBeenCalledWith(blob, 'candidate-cv.pdf');
  });

  it('rejects an external CV URL rather than sending it the user token', async () => {
    render(<DownloadApplicationCvButton applicationId={23} cvUrl="https://external.example/cv.pdf" />);

    fireEvent.click(screen.getByRole('button', { name: 'Download CV' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('unsafe file URL');
    expect(api.get).not.toHaveBeenCalled();
  });
});
