import {
  Bell,
  BookOpen,
  Bot,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  FileArchive,
  FileClock,
  Gauge,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { api } from "../shared/api/endpoints";
import { BrandMark } from "../shared/components/brand-mark";
import type { UserRole } from "../shared/types/domain";

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: typeof Home;
}

const navByRole: Record<UserRole, readonly NavItem[]> = {
  CLIENTE: [
    { to: "/app/inicio", label: "Inicio", icon: Home },
    { to: "/app/solicitudes", label: "Solicitudes", icon: ClipboardList },
    { to: "/app/nueva-solicitud", label: "Crear solicitud", icon: TicketCheck },
    { to: "/app/faq", label: "Preguntas", icon: BookOpen },
    { to: "/app/asistente", label: "Asistente", icon: Bot },
  ],
  ASESOR: [
    { to: "/asesor/panel", label: "Panel", icon: Gauge },
    { to: "/asesor/bandeja", label: "Bandeja", icon: ClipboardList },
    { to: "/asesor/historial", label: "Historial", icon: FileArchive },
    { to: "/asesor/conocimiento", label: "Conocimiento", icon: BookOpen },
  ],
  SUPERVISOR: [
    { to: "/supervisor/operacion", label: "Operación", icon: Gauge },
    { to: "/supervisor/cola", label: "Cola", icon: ClipboardList },
    { to: "/supervisor/historial", label: "Historial", icon: FileArchive },
    { to: "/supervisor/asignaciones", label: "Asignaciones", icon: Users },
    { to: "/supervisor/contenido", label: "Contenido", icon: BookOpen },
    { to: "/supervisor/sla", label: "SLA", icon: FileClock },
    {
      to: "/supervisor/reportes",
      label: "Reportes",
      icon: ChartNoAxesCombined,
    },
    { to: "/supervisor/auditoria", label: "Auditoría", icon: ShieldCheck },
  ],
};

export function AppShell() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const role = session?.user.role ?? "CLIENTE";
  const nav = navByRole[role];
  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: api.notifications.unreadCount,
    refetchInterval: 60_000,
  });
  const notifications = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => api.notifications.list({ page: 1, page_size: 5 }),
    enabled: isNotificationsOpen,
  });
  const readAll = useMutation({
    mutationFn: api.notifications.readAll,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notifications", "unread-count"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications", "recent"],
        }),
      ]);
    },
  });

  const handleLogout = async () => {
    await logout();
    void navigate("/ingresar", { replace: true, state: { reason: "logout" } });
  };

  useEffect(() => {
    if (!isSidebarOpen) return;
    const sidebar = sidebarRef.current;
    const menuButton = menuButtonRef.current;
    const elements = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
    sidebar?.querySelector<HTMLElement>(".sidebar__close")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = elements();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [isSidebarOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-content">
        Saltar al contenido
      </a>
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        className={`sidebar${isSidebarOpen ? " sidebar--open" : ""}`}
        aria-label="Menú de la aplicación"
      >
        <div className="sidebar__head">
          <BrandMark inverse />
          <button
            className="sidebar__close"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Navegación de la aplicación">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__support">
          <HelpCircle aria-hidden="true" />
          <div>
            <strong>¿Necesitas ayuda?</strong>
            <span>Consulta la guía del portal.</span>
          </div>
        </div>
      </aside>
      <div className="app-shell__body">
        <header className="app-header">
          <button
            ref={menuButtonRef}
            className="app-header__menu"
            aria-label="Abrir menú"
            aria-controls="app-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <div className="app-header__context">
            <span>
              {role === "CLIENTE"
                ? "Portal de cliente"
                : role === "ASESOR"
                  ? "Atención operativa"
                  : "Supervisión operativa"}
            </span>
            <strong>{session?.user.full_name}</strong>
          </div>
          <div className="app-header__actions">
            <div className="popover-anchor">
              <button
                className="icon-button"
                aria-label="Notificaciones"
                aria-expanded={isNotificationsOpen}
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Bell aria-hidden="true" />
                {(unread.data?.unread_count ?? 0) > 0 ? (
                  <span>{unread.data?.unread_count}</span>
                ) : null}
              </button>
              {isNotificationsOpen ? (
                <div className="popover notifications">
                  <div className="popover__head">
                    <strong>Notificaciones</strong>
                    <button
                      disabled={readAll.isPending}
                      onClick={() => readAll.mutate()}
                    >
                      {readAll.isPending ? "Marcando…" : "Marcar leídas"}
                    </button>
                  </div>
                  {notifications.isLoading ? (
                    <p>Cargando…</p>
                  ) : notifications.data?.items.length ? (
                    notifications.data.items.map((item) => (
                      <NavLink
                        key={item.id}
                        to={
                          item.related_ticket_id
                            ? `${role === "CLIENTE" ? "/app/solicitudes" : role === "ASESOR" ? "/asesor/tickets" : "/supervisor/tickets"}/${item.related_ticket_id}`
                            : "#"
                        }
                      >
                        {item.title}
                        <small>{item.message}</small>
                      </NavLink>
                    ))
                  ) : (
                    <p>Estás al día.</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="popover-anchor">
              <button
                className="profile-button"
                aria-expanded={isProfileOpen}
                onClick={() => setProfileOpen((current) => !current)}
              >
                <span>
                  {session?.user.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {isProfileOpen ? (
                <div className="popover profile-menu">
                  <NavLink
                    to={
                      role === "CLIENTE"
                        ? "/app/perfil"
                        : role === "ASESOR"
                          ? "/asesor/perfil"
                          : "/supervisor/perfil"
                    }
                  >
                    <Settings aria-hidden="true" />
                    Perfil y preferencias
                  </NavLink>
                  <button onClick={() => void handleLogout()}>
                    <LogOut aria-hidden="true" />
                    Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main id="app-content" className="app-content">
          <Outlet />
        </main>
        <nav className="bottom-nav" aria-label="Navegación móvil">
          {nav.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
