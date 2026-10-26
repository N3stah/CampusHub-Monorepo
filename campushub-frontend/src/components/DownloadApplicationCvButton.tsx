'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';

export default function DownloadApplicationCvButton({ applicationId, cvUrl }: { applicationId: number; cvUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadCv() {
    setLoading(true);
    setError(null);
    try {
      const apiBase = new URL(api.defaults.baseURL ?? window.location.origin, window.location.origin);
      const downloadUrl = new URL(cvUrl, apiBase);
      if (!['http:', 'https:'].includes(downloadUrl.protocol) || downloadUrl.origin !== apiBase.origin) {
        throw new Error('The application returned an unsafe CV URL.');
      }
      const response = await api.get<Blob>(downloadUrl.toString(), {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const filename = typeof disposition === 'string'
        ? disposition.match(/filename="?([^"]+)"?/i)?.[1]
        : null;
      link.download = filename ?? `application-${applicationId}-cv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void downloadCv()}
        disabled={loading}
        className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {loading ? 'Preparing CV…' : 'Download CV'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
