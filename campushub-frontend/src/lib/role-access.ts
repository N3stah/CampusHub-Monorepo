import type { User } from '@/types';

export function isRoleAllowed(role: User['role'] | null | undefined, allowedRoles?: User['role'][]): boolean {
  return role !== null && role !== undefined && (!allowedRoles || allowedRoles.includes(role));
}
