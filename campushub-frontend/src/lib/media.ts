import api from '@/lib/api';

export function resolveMediaUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl || typeof window === 'undefined') return null;
  try {
    const apiBase = new URL(api.defaults.baseURL ?? '/', window.location.origin);
    const mediaUrl = new URL(fileUrl, apiBase);
    if (!['http:', 'https:'].includes(mediaUrl.protocol) || mediaUrl.origin !== apiBase.origin) {
      return null;
    }
    return mediaUrl.toString();
  } catch {
    return null;
  }
}
