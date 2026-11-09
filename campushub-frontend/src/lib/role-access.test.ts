import { describe, expect, it } from 'vitest';
import { hasPermission, isRoleAllowed, manageableAccountRoles, roleLabels } from '@/lib/role-access';

const roles = ['student', 'lecturer', 'officer', 'admin', 'ict_admin', 'registrar', 'finance', 'librarian', 'hostel'] as const;

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

  it('maps institutional roles to their operational permissions', () => {
    expect(hasPermission('finance', 'finance.manage')).toBe(true);
    expect(hasPermission('finance', 'academic.manage')).toBe(false);
    expect(hasPermission('registrar', 'admissions.manage')).toBe(true);
    expect(hasPermission('librarian', 'library.manage')).toBe(true);
    expect(hasPermission('hostel', 'hostel.manage')).toBe(true);
    expect(hasPermission('ict_admin', 'academic.manage')).toBe(true);
    expect(hasPermission('ict_admin', 'users.manage')).toBe(false);
    expect(hasPermission('admin', 'users.manage')).toBe(true);
    expect(hasPermission('admin', 'academic.manage')).toBe(false);
    expect(hasPermission('admin', 'finance.manage')).toBe(false);
    expect(hasPermission('registrar', 'users.manage')).toBe(false);
    expect(roleLabels.finance).toBe('Finance Officer');
    expect(roleLabels.admin).toBe('Super Admin');
  });

  it('limits Super Admin account assignment to staff roles, not students', () => {
    expect(manageableAccountRoles).toContain('admin');
    expect(manageableAccountRoles).toContain('ict_admin');
    expect(manageableAccountRoles).toContain('registrar');
    expect(manageableAccountRoles).toContain('finance');
    expect(manageableAccountRoles).toContain('librarian');
    expect(manageableAccountRoles).toContain('hostel');
    expect(manageableAccountRoles).not.toContain('student');
  });
});
