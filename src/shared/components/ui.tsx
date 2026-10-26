import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import type { TicketPriority, TicketStatus } from "../types/domain";

const responsiveImageAssets = import.meta.glob<string>(
  "../../assets/images/web/*.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);

const responsiveImageUrl = (
  name: string,
  size: "mobile" | "tablet" | "desktop",
) => responsiveImageAssets[`../../assets/images/web/${name}-${size}.webp`];

export function Button({
  className = "",
  variant = "primary",
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: "primary" | "secondary" | "quiet" | "danger";
  readonly isLoading?: boolean;
}) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({
  className = "",
  variant = "primary",
  children,
  ...props
}: LinkProps & { readonly variant?: "primary" | "secondary" | "quiet" }) {
  return (
    <Link className={`button button--${variant} ${className}`} {...props}>
      <span>{children}</span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export function PageIntro({
  title,
  description,
  actions,
  eyebrow,
  className = "",
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly eyebrow?: string;
  readonly className?: string;
}) {
  return (
    <header className={`page-intro ${className}`.trim()}>
      {eyebrow ? <p className="page-intro__context">{eyebrow}</p> : null}
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-intro__actions">{actions}</div> : null}
    </header>
  );
}

export function Reveal({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function StatusBadge({ status }: { readonly status: TicketStatus }) {
  const labels: Record<TicketStatus, string> = {
    NUEVO: "Disponible",
    ASIGNADO: "Por atender",
    EN_PROCESO: "En atención",
    PENDIENTE_CLIENTE: "Esperando al cliente",
    RESUELTO: "Resuelto por cerrar",
    CERRADO: "Cerrado",
    CANCELADO: "Cancelado",
  };
  return (
    <span className={`status status--${status.toLowerCase()}`}>
      <span aria-hidden="true" />
      {labels[status]}
    </span>
  );
}

export function PriorityBadge({
  priority,
}: {
  readonly priority: TicketPriority;
}) {
  return (
    <span className={`priority priority--${priority.toLowerCase()}`}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

export function Skeleton({ rows = 4 }: { readonly rows?: number }) {
  return (
    <div className="skeleton" aria-label="Cargando contenido" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} style={{ width: `${92 - index * 8}%` }} />
      ))}
    </div>
  );
}

export function StatePanel({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}: {
  readonly kind: "empty" | "error" | "success" | "forbidden";
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  const Icon =
    kind === "success"
      ? CheckCircle2
      : kind === "empty"
        ? CircleOff
        : AlertCircle;
  return (
    <section
      className={`state-panel state-panel--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            <RefreshCw aria-hidden="true" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginación de resultados">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      <span aria-live="polite">
        Página {page} de {totalPages} · {total} resultados
      </span>
      <Button
        variant="secondary"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}

export function ResponsiveImage({
  name,
  alt,
  className = "",
}: {
  readonly name: string;
  readonly alt: string;
  readonly className?: string;
}) {
  return (
    <picture className={className}>
      <source
        media="(max-width: 639px)"
        srcSet={responsiveImageUrl(name, "mobile")}
      />
      <source
        media="(max-width: 1099px)"
        srcSet={responsiveImageUrl(name, "tablet")}
      />
      <img
        src={responsiveImageUrl(name, "desktop")}
        alt={alt}
        width={1920}
        height={1080}
        loading={name === "landing-hero" ? "eager" : "lazy"}
        fetchPriority={name === "landing-hero" ? "high" : "auto"}
      />
    </picture>
  );
}
