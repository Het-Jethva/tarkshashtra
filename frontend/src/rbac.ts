import type { CurrentUser, Permission } from './types';

export function hasPermission(user: CurrentUser | null, permission: Permission): boolean {
  if (!user) {
    return false;
  }

  return user.permissions.includes(permission);
}

export function roleInitials(role: CurrentUser['role']): string {
  if (role === 'support_executive') {
    return 'SE';
  }

  if (role === 'quality_assurance') {
    return 'QA';
  }

  return 'OM';
}
