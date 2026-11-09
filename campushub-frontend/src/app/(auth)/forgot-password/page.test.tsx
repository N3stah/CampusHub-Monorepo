import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import api from '@/lib/api';

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ default: mocks.api }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

describe('OTP password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  it('requests a code and submits the OTP with the new password', async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'student@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/password/otp/request/', { email: 'student@example.test' }));
    fireEvent.change(screen.getByLabelText('Email verification code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Secure!Password9' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Secure!Password9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and reset password' }));

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/auth/password/otp/confirm/', {
      email: 'student@example.test',
      otp: '123456',
      new_password: 'Secure!Password9',
    }));
    expect(await screen.findByText('Password reset complete')).toBeInTheDocument();
  });
});
