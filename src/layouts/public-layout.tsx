import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { publicActionForRole } from "../features/auth/roles";
import { AccountMenu } from "../shared/components/account-menu";
import { AcademicDisclaimer } from "../shared/components/academic-disclaimer";
import { BrandMark } from "../shared/components/brand-mark";
import { ButtonLink } from "../shared/components/ui";

const links = [
  { to: "/", label: "Inicio", end: true },
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  { to: "/sobre-el-proyecto", label: "Sobre el proyecto" },
  { to: "/ayuda", label: "Ayuda" },
];

export function PublicLayout() {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const isOpen = openPath === location.pathname;
  const { session } = useAuth();
  const isHowProcess = location.pathname === "/como-funciona";
  const isHelpPage = location.pathname === "/ayuda";
  const roleAction = session
    ? publicActionForRole(session.user.role)
    : null;

  const closeNavigation = () => setOpenPath(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenPath(null);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleHistoryNavigation = () => setOpenPath(null);
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  return (
    <div
      className={`public-shell${isHowProcess ? " public-shell--how-process" : ""}${isHelpPage ? " public-shell--help" : ""}`}
    >
      <a className="skip-link" href="#contenido-principal">
        Saltar al contenido
      </a>
      <header className="public-header">
        <div className="public-header__inner">
          <BrandMark />
          <button
            ref={menuButtonRef}
            className="menu-toggle"
            type="button"
            aria-label={isOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-controls="public-navigation"
            aria-expanded={isOpen}
            onClick={() => setOpenPath(isOpen ? null : location.pathname)}
          >
            {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <nav
            id="public-navigation"
            className={`public-nav${isOpen ? " public-nav--open" : ""}`}
            aria-label="Navegación principal"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={closeNavigation}
              >
                {link.label}
              </NavLink>
            ))}
            {roleAction ? (
              <ButtonLink
                className="public-nav__action"
                to={roleAction.to}
                onClick={closeNavigation}
              >
                {roleAction.label}
              </ButtonLink>
            ) : (
              <>
                <NavLink
                  className="public-nav__login"
                  to="/ingresar"
                  onClick={closeNavigation}
                >
                  Ingresar
                </NavLink>
                <ButtonLink to="/registro" onClick={closeNavigation}>
                  Crear solicitud
                </ButtonLink>
              </>
            )}
          </nav>
          {session ? (
            <AccountMenu
              variant="public"
              closeOnExternal={isOpen}
              onOpen={closeNavigation}
            />
          ) : null}
        </div>
      </header>
      <AcademicDisclaimer />
      <main id="contenido-principal">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__main">
        <BrandMark inverse />
        <p>
          Una experiencia académica para explorar el registro, seguimiento y
          resolución de solicitudes.
        </p>
        <div className="footer__columns">
          <div>
            <strong>Atención digital</strong>
            <NavLink to="/como-funciona">Cómo funciona</NavLink>
            <NavLink to="/preguntas-frecuentes">Preguntas frecuentes</NavLink>
          </div>
          <div>
            <strong>El proyecto</strong>
            <NavLink to="/sobre-el-proyecto">Sobre el proyecto</NavLink>
            <NavLink to="/ayuda">Ayuda y contacto</NavLink>
          </div>
          <div>
            <strong>Legal</strong>
            <NavLink to="/privacidad">Privacidad</NavLink>
            <NavLink to="/terminos">Términos de uso</NavLink>
          </div>
        </div>
      </div>
      <div className="footer__bottom">
        <span>Banco - Atención de Tickets</span>
        <span>Prototipo académico</span>
      </div>
    </footer>
  );
}
