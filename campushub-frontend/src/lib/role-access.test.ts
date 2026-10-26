import { describe, expect, it } from 'vitest';
import { isRoleAllowed } from '@/lib/role-access';

const roles = ['student', 'lecturer', 'officer', 'admin'] as const;

describe('role-based page access', () => {
  it('allows each permitted role and denies roles outside the route policy', () => {
    for (const role of roles) {
      expect(isRoleAllowed(role, ['student', 'officer'])).toBe(['student', 'officer'].includes(role));
    }
  });

  it('denies anonymous users on role-protected pages and allows any authenticated role when unrestricted', () => {
    expect(isRoleAllowed(null)).toBe(false);
    expect(isRoleAllowed(undefined, ['admin'])).toBe(false);
    for (const role of roles) expect(isRoleAllowed(role)).toBe(true);
  });
});
