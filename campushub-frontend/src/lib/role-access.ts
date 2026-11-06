import type { User } from '@/types';

export function isRoleAllowed(role: User['role'] | null | undefined, allowedRoles?: User['role'][]): boolean {
  return role !== null && role !== undefined && (!allowedRoles || allowedRoles.includes(role));
}

export type CampusPermission =
  | 'academic.view'
  | 'academic.manage'
  | 'finance.manage'
  | 'admissions.manage'
  | 'examinations.manage'
  | 'library.manage'
  | 'hostel.manage'
  | 'placements.manage'
  | 'users.manage';

const rolePermissions: Partial<Record<User['role'], CampusPermission[]>> = {
  student: ['academic.view'],
  lecturer: ['academic.view', 'academic.manage'],
  officer: ['placements.manage'],
  admin: [
    'academic.view', 'academic.manage', 'finance.manage', 'admissions.manage',
    'examinations.manage', 'library.manage', 'hostel.manage', 'placements.manage', 'users.manage',
  ],
  registrar: ['academic.view', 'academic.manage', 'admissions.manage', 'examinations.manage', 'users.manage'],
  finance: ['finance.manage'],
  hod: ['academic.view', 'academic.manage'],
  examination: ['academic.view', 'examinations.manage'],
  librarian: ['library.manage'],
  hostel: ['hostel.manage'],
};

export const roleLabels: Record<User['role'], string> = {
  student: 'Student',
  lecturer: 'Lecturer',
  officer: 'Placement Officer',
  admin: 'Administrator',
  registrar: 'Registrar / Academic Officer',
  finance: 'Finance Officer',
  hod: 'Dean / Head of Department',
  examination: 'Examinations Officer',
  librarian: 'Librarian',
  hostel: 'Hostel Warden',
};

export function hasPermission(role: User['role'] | null | undefined, permission: CampusPermission): boolean {
  return !!role && rolePermissions[role]?.includes(permission) === true;
}

export function hasAnyPermission(role: User['role'] | null | undefined, permissions: CampusPermission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}
