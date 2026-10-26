const maxCvSize = 10 * 1024 * 1024;
const allowedCvExtensions = new Set(['pdf', 'doc', 'docx']);

export function validateCvFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!allowedCvExtensions.has(extension)) return 'Choose a PDF, DOC, or DOCX CV.';
  if (file.size > maxCvSize) return 'Your CV must be 10 MB or smaller.';
  return null;
}

export function createApplicationFormData(coverNote: string, cvFile: File | null): FormData {
  const formData = new FormData();
  formData.append('cover_note', coverNote.trim());
  if (cvFile) formData.append('cv_file', cvFile);
  return formData;
}

export function resolveSameOriginFileUrl(fileUrl: string, apiBaseUrl: string, browserOrigin: string): string {
  const apiBase = new URL(apiBaseUrl, browserOrigin);
  const downloadUrl = new URL(fileUrl, apiBase);
  if (!['http:', 'https:'].includes(downloadUrl.protocol) || downloadUrl.origin !== apiBase.origin) {
    throw new Error('The application returned an unsafe file URL.');
  }
  return downloadUrl.toString();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function getDownloadFilename(contentDisposition: unknown, fallback: string): string {
  if (typeof contentDisposition !== 'string') return fallback;
  const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  return filename?.trim() || fallback;
}
