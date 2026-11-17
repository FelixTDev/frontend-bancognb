import type { UserRole } from "../../shared/types/domain";

export interface AccountNavigationLink {
  readonly label: string;
  readonly to: string;
}

const HOME_BY_ROLE: Readonly<Record<UserRole, string>> = {
  CLIENTE: "/app/inicio",
  ASESOR: "/asesor/panel",
  SUPERVISOR: "/supervisor/operacion",
};

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  CLIENTE: "Cliente",
  ASESOR: "Asesor",
  SUPERVISOR: "Supervisor",
};

const PUBLIC_ACTIONS: Readonly<
  Record<UserRole, AccountNavigationLink>
> = {
  CLIENTE: { label: "Nueva solicitud", to: "/app/nueva-solicitud" },
  ASESOR: { label: "Ir a atención", to: "/asesor/panel" },
  SUPERVISOR: { label: "Ir a supervisión", to: "/supervisor/operacion" },
};

const ACCOUNT_LINKS: Readonly<
  Record<UserRole, readonly AccountNavigationLink[]>
> = {
  CLIENTE: [
    { label: "Mis solicitudes", to: "/app/solicitudes" },
    { label: "Perfil", to: "/app/perfil" },
  ],
  ASESOR: [
    { label: "Panel", to: "/asesor/panel" },
    { label: "Bandeja", to: "/asesor/bandeja" },
    { label: "Perfil", to: "/asesor/perfil" },
  ],
  SUPERVISOR: [
    { label: "Panel", to: "/supervisor/operacion" },
    { label: "Cola", to: "/supervisor/cola" },
    { label: "Reportes", to: "/supervisor/reportes" },
    { label: "Perfil", to: "/supervisor/perfil" },
  ],
};

export const homeForRole = (role: UserRole): string => HOME_BY_ROLE[role];

export const labelForRole = (role: UserRole): string => ROLE_LABELS[role];

export const publicActionForRole = (
  role: UserRole,
): AccountNavigationLink => PUBLIC_ACTIONS[role];

export const accountLinksForRole = (
  role: UserRole,
): readonly AccountNavigationLink[] => ACCOUNT_LINKS[role];

export const isRoleAllowed = (
  role: UserRole,
  allowedRoles: readonly UserRole[],
): boolean => allowedRoles.includes(role);
