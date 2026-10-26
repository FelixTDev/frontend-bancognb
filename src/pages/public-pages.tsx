import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  CircleCheckBig,
  Clock3,
  Headphones,
  LockKeyhole,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PublicAssistantWidget } from "../features/chat/public-assistant-widget";
import { api } from "../shared/api/endpoints";
import {
  ButtonLink,
  ResponsiveImage,
  Reveal,
  Skeleton,
  StatePanel,
} from "../shared/components/ui";
import { FaqLibrary } from "../shared/components/faq-library";
import { FaqPageHero } from "../shared/components/faq-page-hero";
import type { Faq, PageResult } from "../shared/types/domain";

const asFaqs = (
  value: readonly Faq[] | PageResult<Faq> | undefined,
): readonly Faq[] => (value ? ("items" in value ? value.items : value) : []);

export function HomePage() {
  const faqQuery = useQuery({
    queryKey: ["faqs", "home"],
    queryFn: () => api.faqs.list({ page: 1, page_size: 4 }),
  });
  const faqs = asFaqs(faqQuery.data).slice(0, 4);
  return (
    <>
      <section className="hero">
        <ResponsiveImage
          name="landing-hero"
          alt="Atrio contemporáneo en tonos navy, piedra clara y latón"
          className="hero__media"
        />
        <div className="hero__shade" />
        <div className="hero__content">
          <h1>Tu solicitud, siempre acompañada.</h1>
          <p>
            Registra una consulta, revisa cada avance y mantén la conversación
            en un solo lugar seguro.
          </p>
          <div className="hero__actions">
            <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
            <ButtonLink to="/ingresar" variant="secondary">
              Revisar mis solicitudes
            </ButtonLink>
          </div>
          <div className="hero__journey" aria-label="Recorrido de atención">
            <span>
              <strong>1</strong>Cuéntanos qué necesitas
            </span>
            <ArrowRight aria-hidden="true" />
            <span>
              <strong>2</strong>Sigue el avance
            </span>
            <ArrowRight aria-hidden="true" />
            <span>
              <strong>3</strong>Recibe una respuesta
            </span>
          </div>
        </div>
      </section>

      <Reveal className="value-strip">
        <p>
          Un canal digital pensado para solicitudes claras, seguimiento visible
          y atención humana cuando la necesitas.
        </p>
        <Link to="/como-funciona">
          Conoce el recorrido <ArrowRight aria-hidden="true" />
        </Link>
      </Reveal>

      <section className="editorial-section benefits">
        <div className="section-heading">
          <h2>La atención se siente distinta cuando sabes qué está pasando.</h2>
          <p>
            Cada paso conserva su contexto, su responsable y su estado para que
            no tengas que empezar de nuevo.
          </p>
        </div>
        <div className="benefit-list">
          <article>
            <Clock3 aria-hidden="true" />
            <h3>Seguimiento sin incertidumbre</h3>
            <p>
              Consulta el estado real de tu solicitud y revisa su historial
              cuando lo necesites.
            </p>
          </article>
          <article>
            <ShieldCheck aria-hidden="true" />
            <h3>Información protegida</h3>
            <p>
              La sesión, los permisos y cada operación siguen controles
              definidos por el servicio.
            </p>
          </article>
          <article>
            <Headphones aria-hidden="true" />
            <h3>Atención con contexto</h3>
            <p>
              El equipo recibe la conversación y los archivos asociados para
              responder con precisión.
            </p>
          </article>
        </div>
      </section>

      <section className="process-story">
        <ResponsiveImage
          name="service-architecture"
          alt="Arquitectura abstracta con una ruta azul continua entre etapas"
        />
        <div className="process-story__content">
          <h2>Un recorrido continuo, no una cadena de formularios.</h2>
          <ol>
            <li>
              <CircleCheckBig aria-hidden="true" />
              <div>
                <strong>Describe tu necesidad</strong>
                <span>Elige una categoría y aporta el contexto esencial.</span>
              </div>
            </li>
            <li>
              <Workflow aria-hidden="true" />
              <div>
                <strong>Conserva la trazabilidad</strong>
                <span>
                  Comentarios, adjuntos y cambios quedan unidos a la solicitud.
                </span>
              </div>
            </li>
            <li>
              <Send aria-hidden="true" />
              <div>
                <strong>Cierra el ciclo</strong>
                <span>
                  Recibe la solución y consulta el historial completo.
                </span>
              </div>
            </li>
          </ol>
          <ButtonLink to="/registro">Comenzar ahora</ButtonLink>
        </div>
      </section>

      <section className="trust-section">
        <div>
          <h2>Confianza construida en cada detalle.</h2>
          <p>
            El portal utiliza sesiones autenticadas, permisos por rol y un
            identificador de solicitud para facilitar el soporte ante cualquier
            incidencia.
          </p>
          <div className="trust-points">
            <span>
              <LockKeyhole aria-hidden="true" />
              Sesión protegida
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              Permisos por rol
            </span>
            <span>
              <Search aria-hidden="true" />
              Trazabilidad de errores
            </span>
          </div>
        </div>
        <ResponsiveImage
          name="security-threshold"
          alt="Umbral de vidrio y metal con una línea dorada de precisión"
        />
      </section>

      <section className="human-section">
        <ResponsiveImage
          name="human-support"
          alt="Asesor orientando a una persona en un espacio de atención reservado"
        />
        <div>
          <h2>Digital cuando conviene. Humana cuando importa.</h2>
          <p>
            El asistente ayuda a encontrar respuestas y, cuando la situación
            requiere seguimiento, la conversación puede convertirse en una
            solicitud para el equipo de atención.
          </p>
          <ButtonLink to="/preguntas-frecuentes" variant="secondary">
            Explorar respuestas
          </ButtonLink>
        </div>
      </section>

      <section className="faq-preview">
        <div className="section-heading">
          <h2>Respuestas para avanzar con claridad.</h2>
          <Link to="/preguntas-frecuentes">
            Ver todas <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        {faqQuery.isLoading ? (
          <Skeleton rows={4} />
        ) : faqQuery.isError ? (
          <StatePanel
            kind="error"
            title="No pudimos cargar las preguntas"
            message="Inténtalo nuevamente en unos minutos."
            actionLabel="Reintentar"
            onAction={() => void faqQuery.refetch()}
          />
        ) : (
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.id}>
                <summary>
                  {faq.question}
                  <ChevronDown aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="closing-cta">
        <div>
          <h2>Empieza con una solicitud clara.</h2>
          <p>
            Te acompañaremos con estados visibles y una conversación que
            conserva su contexto.
          </p>
        </div>
        <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
      </section>
      <PublicAssistantWidget />
    </>
  );
}

export function HowItWorksPage() {
  return (
    <StandardPage
      title="Un recorrido diseñado para mantenerte informado"
      intro="Desde la primera consulta hasta el cierre, cada acción queda dentro de una sola historia de atención."
    >
      <div className="long-process">
        <article>
          <span>01</span>
          <div>
            <h2>Orientación inicial</h2>
            <p>
              Consulta la base de conocimiento o conversa con el asistente para
              identificar el camino adecuado.
            </p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>Registro con contexto</h2>
            <p>
              Selecciona una categoría, describe la situación y adjunta los
              documentos permitidos.
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>Seguimiento y conversación</h2>
            <p>
              Revisa el estado, los tiempos operativos y agrega información en
              el mismo hilo.
            </p>
          </div>
        </article>
        <article>
          <span>04</span>
          <div>
            <h2>Resolución trazable</h2>
            <p>
              La respuesta, los cambios de estado y el historial permanecen
              disponibles en el detalle.
            </p>
          </div>
        </article>
      </div>
    </StandardPage>
  );
}

export function PublicFaqPage() {
  return (
    <div className="standard-page standard-page--faq">
      <FaqPageHero
        title="Preguntas frecuentes"
        description="Encuentra orientación antes de registrar una solicitud."
      />
      <FaqLibrary audience="public" />
    </div>
  );
}

export function AboutPage() {
  return (
    <main className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <ResponsiveImage
          name="landing-hero"
          alt="Atrio contemporáneo en tonos navy, piedra clara y latón"
          className="about-hero__media"
        />
        <div className="about-hero__shade" />
        <div className="about-hero__content">
          <p className="about-eyebrow">Banco GNB Perú</p>
          <h1 id="about-title">
            Una historia de confianza que sigue avanzando
          </h1>
          <p className="about-hero__intro">
            Respaldo regional y atención cercana para acompañar a personas y
            empresas en el Perú.
          </p>
          <div className="about-actions">
            <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
            <ButtonLink to="/preguntas-frecuentes" variant="secondary">
              Ir a preguntas frecuentes
            </ButtonLink>
          </div>
          <p className="about-hero__note">
            Atención personalizada y calificada
          </p>
        </div>
      </section>

      <Reveal className="about-intro">
        <div className="about-heading">
          <p className="about-eyebrow">Nuestra identidad</p>
          <h2>Quiénes somos</h2>
        </div>
        <div className="about-intro__copy">
          <p>
            Banco GNB Perú forma parte del grupo Banco GNB Sudameris S.A. y
            opera en el país desde octubre de 2013.
          </p>
          <p>
            La presencia del grupo en el Perú y Latinoamérica se sostiene en una
            trayectoria de más de 100 años en el mercado financiero colombiano.
          </p>
        </div>
      </Reveal>

      <Reveal className="about-history">
        <div className="about-heading about-heading--inverse">
          <p className="about-eyebrow">Trayectoria</p>
          <h2>Hitos que dan contexto a nuestro presente</h2>
        </div>
        <ol className="about-history__timeline">
          <li>
            <strong>Más de 100 años</strong>
            <span>de trayectoria del grupo en Colombia</span>
          </li>
          <li>
            <strong>Octubre de 2013</strong>
            <span>inicio de operaciones en el Perú</span>
          </li>
          <li>
            <strong>10 agencias</strong>
            <span>como parte de la presencia nacional</span>
          </li>
          <li>
            <strong>Más de 500</strong>
            <span>colaboradores en Banco GNB Perú</span>
          </li>
        </ol>
      </Reveal>

      <Reveal className="about-presence">
        <ResponsiveImage
          name="service-architecture"
          alt="Arquitectura abstracta con una ruta azul continua entre etapas"
          className="about-presence__media"
        />
        <div className="about-presence__content">
          <p className="about-eyebrow">Cobertura</p>
          <h2>Presencia que conecta</h2>
          <p>
            La red de Banco GNB Perú está compuesta por diez agencias: seis en
            Lima y cuatro en provincias.
          </p>
          <div
            className="about-presence__figures"
            aria-label="Distribución de agencias"
          >
            <span>
              <strong>6</strong>
              Lima
            </span>
            <span>
              <strong>4</strong>
              Provincias
            </span>
          </div>
          <p className="about-presence__note">
            Atención para los segmentos de Banca Personal y Banca Empresarial.
          </p>
        </div>
      </Reveal>

      <section
        className="about-segments"
        aria-labelledby="about-segments-title"
      >
        <div className="about-segments__heading">
          <p className="about-eyebrow">A quiénes acompañamos</p>
          <h2 id="about-segments-title">Dos segmentos, una atención cercana</h2>
        </div>
        <div className="about-segments__stories">
          <Reveal className="about-segment about-segment--personal">
            <ResponsiveImage
              name="personal-banking"
              alt="Asesora conversando con un cliente en un espacio de atención cercano"
              className="about-segment__media"
            />
            <div className="about-segment__copy">
              <span aria-hidden="true">01</span>
              <h3>Banca Personal</h3>
              <p>
                Atención personalizada para personas, con orientación clara y un
                servicio calificado.
              </p>
            </div>
          </Reveal>
          <Reveal className="about-segment about-segment--business">
            <ResponsiveImage
              name="business-banking"
              alt="Equipo empresarial reunido alrededor de una mesa de trabajo"
              className="about-segment__media"
            />
            <div className="about-segment__copy">
              <span aria-hidden="true">02</span>
              <h3>Banca Empresarial</h3>
              <p>
                Acompañamiento para empresas, respaldado por la experiencia y la
                presencia regional del grupo.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <Reveal className="about-service">
        <div className="about-service__content">
          <p className="about-eyebrow">Nuestro canal digital</p>
          <h2>Atención humana y calificada</h2>
          <p>
            En este portal, la cercanía se traduce en una experiencia simple
            para registrar solicitudes, seguir cada avance y mantener la
            conversación en un solo lugar.
          </p>
          <ul>
            <li>Registro claro de cada solicitud</li>
            <li>Seguimiento visible del proceso</li>
            <li>Conversaciones que conservan su contexto</li>
          </ul>
        </div>
        <ResponsiveImage
          name="human-support"
          alt="Asesor orientando a una persona en un espacio de atención reservado"
          className="about-service__media"
        />
      </Reveal>

      <Reveal className="about-closing">
        <div>
          <p className="about-eyebrow">Banco GNB Perú</p>
          <h2>Juntos llegamos más lejos</h2>
          <p>
            Encuentra orientación o inicia una solicitud desde este canal de
            atención digital.
          </p>
        </div>
        <div className="about-actions">
          <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
          <ButtonLink to="/preguntas-frecuentes" variant="secondary">
            Ir a preguntas frecuentes
          </ButtonLink>
        </div>
      </Reveal>
    </main>
  );
}

export function HelpPage() {
  return (
    <StandardPage
      title="Ayuda y contacto"
      intro="Elige el canal adecuado según el punto en el que te encuentres."
    >
      <div className="help-options">
        <article>
          <BookIcon />
          <h2>Orientación inmediata</h2>
          <p>
            Consulta las preguntas frecuentes para resolver dudas habituales.
          </p>
          <ButtonLink to="/preguntas-frecuentes" variant="secondary">
            Ver preguntas
          </ButtonLink>
        </article>
        <article>
          <TicketIcon />
          <h2>Seguimiento personalizado</h2>
          <p>
            Inicia sesión para registrar una solicitud o revisar una
            conversación existente.
          </p>
          <ButtonLink to="/ingresar">Ingresar al portal</ButtonLink>
        </article>
      </div>
    </StandardPage>
  );
}

const BookIcon = () => <Sparkles aria-hidden="true" />;
const TicketIcon = () => <Building2 aria-hidden="true" />;

export function LegalPage({ type }: { readonly type: "privacy" | "terms" }) {
  return (
    <StandardPage
      title={type === "privacy" ? "Privacidad" : "Términos de uso"}
      intro={
        type === "privacy"
          ? "Principios aplicables al tratamiento de información dentro del portal."
          : "Condiciones generales para utilizar el canal de atención digital."
      }
    >
      <div className="legal-copy">
        {type === "privacy" ? (
          <>
            <h2>Información utilizada por el servicio</h2>
            <p>
              El portal procesa los datos necesarios para autenticar al usuario,
              registrar solicitudes y mantener la trazabilidad de atención. No
              muestres contraseñas, códigos de acceso ni información innecesaria
              en comentarios o adjuntos.
            </p>
            <h2>Seguridad y soporte</h2>
            <p>
              Los errores incluyen un identificador de solicitud que puede
              compartirse con soporte para facilitar el diagnóstico sin revelar
              credenciales.
            </p>
          </>
        ) : (
          <>
            <h2>Uso del canal</h2>
            <p>
              Este portal está destinado a consultas y seguimiento de atención.
              No reemplaza los canales definidos para operaciones bancarias,
              emergencias o transacciones.
            </p>
            <h2>Responsabilidad del usuario</h2>
            <p>
              Mantén tus credenciales bajo control y cierra la sesión en
              dispositivos compartidos.
            </p>
          </>
        )}
      </div>
    </StandardPage>
  );
}

function StandardPage({
  title,
  intro,
  children,
  className = "",
}: {
  readonly title: string;
  readonly intro: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={`standard-page ${className}`.trim()}>
      <header>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div>{children}</div>
    </div>
  );
}
