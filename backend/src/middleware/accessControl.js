import { authorizeRole } from './authorizeRole.js';

export const ADMIN_ONLY_ROLES = ['admin'];
export const ADMIN_AREA_ROLES = ['admin', 'manager'];

export function isAdminRole(role) {
  return ADMIN_ONLY_ROLES.includes(role);
}

export function canAccessAdminArea(role) {
  return ADMIN_AREA_ROLES.includes(role);
}

export const authorizeAdminOnly = authorizeRole(...ADMIN_ONLY_ROLES);
export const authorizeAdminArea = authorizeRole(...ADMIN_AREA_ROLES);
export const authorizeManagerManagement = authorizeAdminOnly;
export const authorizeQuestionnaireManagement = authorizeAdminOnly;
