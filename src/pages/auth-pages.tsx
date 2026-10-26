import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../features/auth/auth-context";
import { homeForRole } from "../features/auth/roles";
import { getSafeReturnTo, withReturnTo } from "../features/auth/return-to";
import {
  loginSchema,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from "../features/auth/validation";
import { api } from "../shared/api/endpoints";
import { ApiError } from "../shared/api/http";
import { BrandMark } from "../shared/components/brand-mark";
import { Button, ResponsiveImage } from "../shared/components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const locationState = location.state as
    | { reason?: string; from?: string }
    | null;
  const reason = locationState?.reason;
  const returnTo =
    getSafeReturnTo(searchParams.get("returnTo")) ??
    getSafeReturnTo(locationState?.from);

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    try {
      const session = await login(values);
      void navigate(returnTo ?? homeForRole(session.user.role), {
        replace: true,
      });
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : "No pudimos iniciar sesión. Inténtalo nuevamente.",
      );
    }
  });

  return (
    <AuthFrame
      title="Bienvenido de nuevo"
      description="Ingresa para revisar tus solicitudes y continuar las conversaciones pendientes."
    >
      {reason === "session-required" ? (
        <div className="form-notice">
          {returnTo === "/app/asistente"
            ? "Tu sesión venció. Inicia sesión para retomar esta conversación y revisar la solicitud antes de enviarla."
            : "Inicia sesión para acceder a esta sección."}
        </div>
      ) : reason === "logout" ? (
        <div className="form-success">Tu sesión se cerró correctamente.</div>
      ) : null}
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field
          label="Correo electrónico"
          error={form.formState.errors.email?.message}
        >
          <input
            type="email"
            autoComplete="email"
            {...form.register("email")}
            aria-invalid={Boolean(form.formState.errors.email)}
          />
        </Field>
        <Field
          label="Contraseña"
          error={form.formState.errors.password?.message}
        >
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...form.register("password")}
              aria-invalid={Boolean(form.formState.errors.password)}
            />
            <button
              type="button"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>
        <div className="form-row">
          <label className="check">
            <input type="checkbox" />
            Mantener mi correo en este dispositivo
          </label>
          <Link to="/recuperar-acceso">¿Olvidaste tu contraseña?</Link>
        </div>
        {apiError ? (
          <div className="form-error" role="alert">
            {apiError}
          </div>
        ) : null}
        <Button type="submit" isLoading={form.formState.isSubmitting}>
          Ingresar
        </Button>
      </form>
      <p className="auth-switch">
        ¿Aún no tienes acceso?{" "}
        <Link to={withReturnTo("/registro", returnTo)}>Crea tu cuenta</Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", password: "", phone: "" },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    try {
      await api.auth.register(values);
      void navigate(withReturnTo("/verificar-cuenta", returnTo), {
        state: { registered: true },
      });
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : "No pudimos crear la cuenta.",
      );
    }
  });
  return (
    <AuthFrame
      title="Crea tu acceso"
      description="Registra tus datos para iniciar solicitudes y mantener su seguimiento."
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field
          label="Nombre completo"
          error={form.formState.errors.full_name?.message}
        >
          <input autoComplete="name" {...form.register("full_name")} />
        </Field>
        <Field
          label="Correo electrónico"
          error={form.formState.errors.email?.message}
        >
          <input
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </Field>
        <Field
          label="Teléfono (opcional)"
          error={form.formState.errors.phone?.message}
        >
          <input type="tel" autoComplete="tel" {...form.register("phone")} />
        </Field>
        <Field
          label="Contraseña"
          hint="8 caracteres como mínimo, con mayúscula, minúscula y número."
          error={form.formState.errors.password?.message}
        >
          <input
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </Field>
        {apiError ? (
          <div className="form-error" role="alert">
            {apiError}
          </div>
        ) : null}
        <Button type="submit" isLoading={form.formState.isSubmitting}>
          Crear cuenta
        </Button>
      </form>
      <p className="auth-switch">
        ¿Ya tienes cuenta?{" "}
        <Link to={withReturnTo("/ingresar", returnTo)}>Ingresa aquí</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(
      z.object({ email: z.email("Ingresa un correo válido.") }),
    ),
    defaultValues: { email: "" },
  });
  const submit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No pudimos procesar la solicitud.",
      );
    }
  });
  return (
    <AuthFrame
      title={sent ? "Revisa tu correo" : "Recupera tu acceso"}
      description={
        sent
          ? "Si el correo corresponde a una cuenta, recibirás las instrucciones para continuar."
          : "Indica el correo asociado a tu cuenta."
      }
    >
      {sent ? (
        <AuthResult
          icon={<MailCheck />}
          title="Solicitud recibida"
          message="Por seguridad, mostramos el mismo resultado para todos los correos."
        />
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <Field
            label="Correo electrónico"
            error={form.formState.errors.email?.message}
          >
            <input
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
          </Field>
          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}
          <Button type="submit" isLoading={form.formState.isSubmitting}>
            Enviar instrucciones
          </Button>
        </form>
      )}
      <Link className="back-link" to="/ingresar">
        <ArrowLeft aria-hidden="true" />
        Volver al ingreso
      </Link>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schema = z
    .object({
      password: z
        .string()
        .min(8, "Usa al menos 8 caracteres.")
        .regex(/[A-Z]/)
        .regex(/[a-z]/)
        .regex(/[0-9]/),
      confirm: z.string(),
    })
    .refine((values) => values.password === values.confirm, {
      path: ["confirm"],
      message: "Las contraseñas no coinciden.",
    });
  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    if (!token) {
      setError("El enlace de recuperación no es válido. Solicita uno nuevo.");
      return;
    }
    try {
      await api.auth.resetPassword({ token, new_password: password });
      setCompleted(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "No pudimos actualizar la contraseña.",
      );
    }
  });
  return (
    <AuthFrame
      title="Define una nueva contraseña"
      description="El cambio cerrará las sesiones anteriores para proteger tu cuenta."
    >
      {completed ? (
        <AuthResult
          icon={<CheckCircle2 />}
          title="Contraseña actualizada"
          message="Ya puedes ingresar con tu nueva contraseña."
          action={
            <Link className="button button--primary" to="/ingresar">
              Ir al ingreso
            </Link>
          }
        />
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <Field
            label="Nueva contraseña"
            error={form.formState.errors.password?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
          </Field>
          <Field
            label="Confirma la contraseña"
            error={form.formState.errors.confirm?.message}
          >
            <input
              type="password"
              autoComplete="new-password"
              {...form.register("confirm")}
            />
          </Field>
          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}
          <Button type="submit" isLoading={form.formState.isSubmitting}>
            Actualizar contraseña
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}

export function VerifyAccountPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const returnTo =
    getSafeReturnTo(params.get("returnTo")) ??
    getSafeReturnTo(
      (location.state as { returnTo?: string } | null)?.returnTo,
    );
  const token = params.get("token");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >(
    (location.state as { registered?: boolean } | null)?.registered
      ? "idle"
      : token
        ? "loading"
        : "idle",
  );
  const [message, setMessage] = useState(
    "Revisa tu correo y abre el enlace de verificación para confirmar tu cuenta.",
  );
  useEffect(() => {
    if (token)
      void api.auth
        .verifyEmail(token)
        .then(() => {
          setStatus("success");
          setMessage("Tu correo fue verificado. Ya puedes ingresar.");
        })
        .catch((error: unknown) => {
          setStatus("error");
          setMessage(
            error instanceof ApiError
              ? error.message
              : "No pudimos verificar el enlace.",
          );
        });
  }, [token]);
  return (
    <AuthFrame
      title="Verificación de cuenta"
      description="Confirmamos que el correo te pertenece antes de completar el proceso."
    >
      <AuthResult
        icon={status === "success" ? <CheckCircle2 /> : <MailCheck />}
        title={
          status === "loading"
            ? "Verificando"
            : status === "error"
              ? "No pudimos verificar la cuenta"
              : status === "success"
                ? "Cuenta verificada"
                : "Consulta tu correo"
        }
        message={message}
        action={
          status !== "loading" ? (
            <Link
              className="button button--primary"
              to={withReturnTo("/ingresar", returnTo)}
            >
              Ir al ingreso
            </Link>
          ) : undefined
        }
      />
    </AuthFrame>
  );
}

function AuthFrame({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <aside>
        <ResponsiveImage
          name="security-threshold"
          alt="Umbral de vidrio y metal que representa un acceso protegido"
        />
        <div>
          <BrandMark inverse />
          <blockquote>
            “Un acceso claro es el primer paso para una atención confiable.”
          </blockquote>
          <span>
            <ShieldCheck aria-hidden="true" />
            Sesión y datos protegidos
          </span>
        </div>
      </aside>
      <main>
        <div className="auth-card">
          <BrandMark />
          <header>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? (
        <small className="field__error" role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
}

function AuthResult({
  icon,
  title,
  message,
  action,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="auth-result">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}
