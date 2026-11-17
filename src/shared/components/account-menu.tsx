import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/auth-context";
import { accountLinksForRole, labelForRole } from "../../features/auth/roles";

export function AccountMenu({
  variant,
  closeOnExternal = false,
  onOpen,
  onLogoutComplete,
}: {
  readonly variant: "public" | "portal";
  readonly closeOnExternal?: boolean;
  readonly onOpen?: () => void;
  readonly onLogoutComplete?: () => void;
}) {
  const { session, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `account-menu-${useId()}`;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!closeOnExternal) return;
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [closeOnExternal]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  if (!session) return null;

  const { full_name: fullName, role } = session.user;
  const roleLabel = labelForRole(role);
  const initials = fullName
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase("es-PE") ?? "")
    .join("");

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setOpen(nextOpen);
    if (nextOpen) onOpen?.();
  };

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } catch {
      // The auth provider clears the local session even if the request fails.
    }
    onLogoutComplete?.();
  };

  return (
    <div
      ref={rootRef}
      className={`account-menu account-menu--${variant} popover-anchor`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="profile-button"
        aria-label={`Cuenta de ${fullName}, ${roleLabel}`}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={handleToggle}
      >
        <span className="profile-button__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="profile-button__identity">
          <strong>{fullName}</strong>
          <small>{roleLabel}</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      <nav
        id={menuId}
        className="popover profile-menu"
        aria-label={`Opciones de cuenta de ${roleLabel}`}
        hidden={!isOpen}
      >
        <div className="profile-menu__identity">
          <strong>{fullName}</strong>
          <span>{roleLabel}</span>
        </div>
        {accountLinksForRole(role).map(({ label, to }) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)}>
            {label}
          </NavLink>
        ))}
        <button type="button" onClick={() => void handleLogout()}>
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </button>
      </nav>
    </div>
  );
}
