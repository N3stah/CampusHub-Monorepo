'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { downloadBlob, getDownloadFilename } from '@/lib/application-files';
import { getApiErrorMessage } from '@/lib/portal';

export default function CalendarExportButton() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadCalendar() {
    setDownloading(true);
    setError(null);
    try {
      const response = await api.get<Blob>('/academics/calendar.ics', { responseType: 'blob' });
      downloadBlob(
        response.data,
        getDownloadFilename(response.headers['content-disposition'], 'campushub-calendar.ics'),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => void downloadCalendar()} disabled={downloading} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
        {downloading ? 'Preparing…' : 'Download .ics'}
      </button>
      {error && <span role="alert" className="max-w-48 text-right text-xs text-red-700">{error}</span>}
    </div>
  );
}
