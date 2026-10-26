'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/portal';
import { downloadBlob, getDownloadFilename, resolveSameOriginFileUrl } from '@/lib/application-files';

export default function DownloadApplicationCvButton({ applicationId, cvUrl }: { applicationId: number; cvUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadCv() {
    setLoading(true);
    setError(null);
    try {
      const downloadUrl = resolveSameOriginFileUrl(
        cvUrl,
        api.defaults.baseURL ?? window.location.origin,
        window.location.origin,
      );
      const response = await api.get<Blob>(downloadUrl, {
        responseType: 'blob',
      });
      const filename = getDownloadFilename(response.headers['content-disposition'], `application-${applicationId}-cv`);
      downloadBlob(response.data, filename);
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
