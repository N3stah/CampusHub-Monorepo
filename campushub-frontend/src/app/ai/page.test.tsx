import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AIPage from '@/app/ai/page';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/PortalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const student = {
  id: 21,
  email: 'student@example.test',
  username: 'student',
  first_name: 'Jamie',
  last_name: 'Student',
  role: 'student' as const,
  department: null,
  gpa: null,
  is_active: true,
  date_joined: '2026-01-01',
};

const feed = {
  feed: { summary: 'Review your upcoming coursework this week.', provider: 'mock', context_role: 'student' },
  cached: true,
  generated_at: '2026-11-09T08:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.mocked(useAuth).mockReturnValue({
    user: student,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  });
  vi.mocked(api.get).mockImplementation(async (endpoint) => {
    if (endpoint === '/ai/feed/') return { data: feed };
    if (endpoint === '/ai/tasks/') {
      return { data: { count: 3, results: [{ type: 'study_plan', description: 'Generate a personalized study plan', required_params: ['topics'] }] } };
    }
    throw new Error(`Unexpected GET ${String(endpoint)}`);
  });
  vi.mocked(api.post).mockImplementation(async (endpoint) => {
    if (endpoint === '/ai/chat/') {
      return { data: { conversation_id: 45, message: { id: 2, role: 'assistant', content: 'Break the topics into short sessions.', provider: 'mock' } } };
    }
    if (endpoint === '/ai/task/') {
      return { data: { task_type: 'study_plan', draft: 'Monday: review the first topic.', provider: 'mock', warning: 'Draft only.' } };
    }
    throw new Error(`Unexpected POST ${String(endpoint)}`);
  });
});

describe('CampusHub AI workspace', () => {
  it('loads the daily feed and role tasks, then returns reviewable task and chat drafts', async () => {
    render(<AIPage />);

    expect(await screen.findByText(feed.feed.summary)).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Personalized study plan' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('topics'), { target: { value: 'Functions and recursion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate draft' }));
    expect(await screen.findByText('Monday: review the first topic.')).toBeInTheDocument();
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/task/', {
      task_type: 'study_plan',
      params: { topics: 'Functions and recursion' },
    }));

    fireEvent.change(screen.getByLabelText('Message CampusHub AI'), { target: { value: 'How should I study?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Break the topics into short sessions.')).toBeInTheDocument();
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/chat/', { message: 'How should I study?' }));
    expect(window.localStorage.getItem('campushub-ai-conversation:21')).toBe('45');
  });

  it('shows admin analytics from the protected analytics endpoint', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { ...student, role: 'admin' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(api.get).mockImplementation(async (endpoint) => {
      if (endpoint === '/ai/feed/') return { data: { ...feed, feed: { ...feed.feed, context_role: 'admin' } } };
      if (endpoint === '/ai/tasks/') return { data: { count: 1, results: [{ type: 'system_report', description: 'Generate system health report', required_params: [] }] } };
      if (endpoint === '/ai/analytics/') {
        return {
          data: {
            usage: { total_task_calls: 18, calls_today: 4, by_provider: { mock: 18 } },
            models: {
              at_risk: { trained: false, available_rows: 40, required_rows: 200, available_offerings: 1, required_offerings: 3, status: 'not yet trained: 40/200 rows, 1/3 offerings' },
              placement: { trained: false, available_rows: 12, required_rows: 200, status: 'not yet trained: 12/200 rows' },
            },
          },
        };
      }
      throw new Error(`Unexpected GET ${String(endpoint)}`);
    });

    render(<AIPage />);

    expect(await screen.findByText('18')).toBeInTheDocument();
    expect(screen.getByText('Calls in the last 24 hours').parentElement).toHaveTextContent('4');
    expect(screen.getByText(/40\/200 rows/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/ai/analytics/', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
