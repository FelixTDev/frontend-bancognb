import {
  AlertTriangle,
  ArrowLeft,
  Home,
  LockKeyhole,
  SearchX,
} from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { ButtonLink } from "../shared/components/ui";

export function NoAccessPage() {
  return (
    <div className="system-page">
      <LockKeyhole aria-hidden="true" />
      <h1>Acceso no autorizado</h1>
      <p>Tu sesión está activa, pero tu rol no incluye esta sección.</p>
      <ButtonLink to="/">Volver al inicio</ButtonLink>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="system-page">
      <SearchX aria-hidden="true" />
      <h1>No encontramos esta página</h1>
      <p>
        La dirección puede haber cambiado o el contenido ya no está disponible.
      </p>
      <div>
        <ButtonLink to="/">Ir al inicio</ButtonLink>
        <Link className="back-link" to="..">
          <ArrowLeft aria-hidden="true" />
          Volver
        </Link>
      </div>
    </div>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message =
    isRouteErrorResponse(error) && error.status === 404
      ? "No encontramos la ruta solicitada."
      : "Ocurrió un error inesperado al mostrar esta sección.";
  return (
    <div className="system-page">
      <AlertTriangle aria-hidden="true" />
      <h1>No pudimos mostrar la página</h1>
      <p>{message}</p>
      <ButtonLink to="/">
        <Home aria-hidden="true" />
        Ir al inicio
      </ButtonLink>
    </div>
  );
}
