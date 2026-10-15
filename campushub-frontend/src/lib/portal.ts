import { isAxiosError } from 'axios';
import api from '@/lib/api';
import { ApiPage } from '@/types/portal';

export async function getApiPage<T>(
  endpoint: string,
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<ApiPage<T>> {
  const response = await api.get<unknown>(endpoint, { params, signal });
  const data = response.data;

  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data as T[] };
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'results' in data &&
    Array.isArray(data.results)
  ) {
    const page = data as { count?: unknown; next?: unknown; previous?: unknown; results: T[] };
    return {
      count: typeof page.count === 'number' ? page.count : data.results.length,
      next: typeof page.next === 'string' ? page.next : null,
      previous: typeof page.previous === 'string' ? page.previous : null,
      results: page.results,
    };
  }

  throw new Error(`Unexpected response from ${endpoint}. Expected a list or paginated results.`);
}

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;

    if (error.response?.status === 404) {
      return 'This API endpoint is not available yet.';
    }

    if (error.response?.status === 403) {
      return 'You do not have permission to view this information.';
    }

    if (!error.response) {
      return 'Could not reach the CampusHub API. Check the backend connection and try again.';
    }
  }

  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function getDepartmentName(
  department: DirectoryUserDepartment,
): string {
  if (department === null) return '—';
  if (typeof department === 'object') return department.name ?? '—';
  return String(department);
}

type DirectoryUserDepartment = number | string | { name?: string } | null;
