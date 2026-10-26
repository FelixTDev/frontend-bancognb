import type { UserRole } from "../../shared/types/domain";

const HOME_BY_ROLE: Readonly<Record<UserRole, string>> = {
  CLIENTE: "/app/inicio",
  ASESOR: "/asesor/panel",
  SUPERVISOR: "/supervisor/operacion",
};

export const homeForRole = (role: UserRole): string => HOME_BY_ROLE[role];

export const isRoleAllowed = (
  role: UserRole,
  allowedRoles: readonly UserRole[],
): boolean => allowedRoles.includes(role);
