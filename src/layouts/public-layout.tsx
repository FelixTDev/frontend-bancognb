import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BrandMark } from "../shared/components/brand-mark";
import { ButtonLink } from "../shared/components/ui";

const links = [
  { to: "/", label: "Inicio", end: true },
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/ayuda", label: "Ayuda" },
];

export function PublicLayout() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="public-shell">
      <a className="skip-link" href="#contenido-principal">
        Saltar al contenido
      </a>
      <header className="public-header">
        <div className="public-header__inner">
          <BrandMark />
          <button
            className="menu-toggle"
            type="button"
            aria-label={isOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <nav
            className={`public-nav${isOpen ? " public-nav--open" : ""}`}
            aria-label="Navegación principal"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink
              className="public-nav__login"
              to="/ingresar"
              onClick={() => setIsOpen(false)}
            >
              Ingresar
            </NavLink>
            <ButtonLink to="/registro" onClick={() => setIsOpen(false)}>
              Crear solicitud
            </ButtonLink>
          </nav>
        </div>
      </header>
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
          Un canal claro para registrar, seguir y resolver tus solicitudes con
          trazabilidad.
        </p>
        <div className="footer__columns">
          <div>
            <strong>Atención digital</strong>
            <NavLink to="/como-funciona">Cómo funciona</NavLink>
            <NavLink to="/preguntas-frecuentes">Preguntas frecuentes</NavLink>
          </div>
          <div>
            <strong>Institucional</strong>
            <NavLink to="/nosotros">Nosotros</NavLink>
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
        <span>Banco GNB Perú</span>
        <span>Atención Digital</span>
      </div>
    </footer>
  );
}
