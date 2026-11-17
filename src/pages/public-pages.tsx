import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowRight,
  Bot,
  BookOpenCheck,
  ChevronDown,
  CircleCheckBig,
  ClipboardList,
  Clock3,
  FileText,
  Headphones,
  LockKeyhole,
  MessagesSquare,
  Search,
  Send,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import "./help.css";
import "./how-it-works.css";
import { requestOpenPublicAssistant } from "../features/chat/public-assistant-widget";
import { api } from "../shared/api/endpoints";
import { getSafeFaqContent } from "../shared/faq-content";
import {
  Button,
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
              {faqs.map((faq) => {
                const content = getSafeFaqContent(faq);
                return (
                  <details key={faq.id}>
                    <summary>
                      {content.question}
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <p>{content.answer}</p>
                  </details>
                );
              })}
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
    </>
  );
}

export function HowItWorksPage() {
  return (
    <div className="how-process-page">
      <section className="how-process-hero" aria-labelledby="how-process-title">
        <div className="how-process-hero__copy">
          <h1 id="how-process-title">
            De la primera consulta a la respuesta, con todo en contexto.
          </h1>
          <p>
            Encuentra una respuesta, registra tu caso si necesitas atención y
            consulta cada avance desde un mismo recorrido digital.
          </p>
          <p className="how-process-hero__note">
            <MessagesSquare aria-hidden="true" />
            Los mensajes, archivos y actualizaciones permanecen vinculados a tu
            solicitud.
          </p>
        </div>

        <figure className="how-process-hero__visual">
          <ResponsiveImage
            name="service-architecture"
            alt="Una ruta azul atraviesa espacios arquitectónicos en tonos navy, piedra clara y dorado."
            className="how-process-hero__picture"
          />
        </figure>
      </section>

      <section
        className="how-process-journey"
        aria-labelledby="how-process-journey-title"
      >
        <header className="how-process-section-heading">
          <h2 id="how-process-journey-title">
            Cuatro momentos, una misma historia.
          </h2>
          <p>
            Empieza resolviendo una duda y, si necesitas ayuda, convierte la
            conversación en una solicitud. Desde ese mismo registro puedes
            consultar el estado, responder al equipo y volver a la solución.
          </p>
        </header>
        <ol className="how-process-steps">
          <li>
            <span className="how-process-step__number">01</span>
            <span className="how-process-step__icon">
              <Search aria-hidden="true" />
            </span>
            <div className="how-process-step__copy">
              <h3>Encuentra orientación</h3>
              <p>
                Revisa las preguntas frecuentes o consulta al asistente para
                entender qué opción se ajusta a tu necesidad.
              </p>
              <Link to="/preguntas-frecuentes">
                Buscar una respuesta <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </li>
          <li>
            <span className="how-process-step__number">02</span>
            <span className="how-process-step__icon">
              <FileText aria-hidden="true" />
            </span>
            <div className="how-process-step__copy">
              <h3>Registra con contexto</h3>
              <p>
                Elige una categoría, describe lo ocurrido y define la prioridad
                para que el equipo reciba una solicitud clara.
              </p>
              <Link to="/registro">
                Crear solicitud <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </li>
          <li>
            <span className="how-process-step__number">03</span>
            <span className="how-process-step__icon">
              <Workflow aria-hidden="true" />
            </span>
            <div className="how-process-step__copy">
              <h3>Sigue cada avance</h3>
              <p>
                Consulta el estado, revisa los mensajes del equipo y responde
                desde el detalle si necesitan información adicional.
              </p>
              <Link to="/ingresar?returnTo=%2Fapp%2Fsolicitudes">
                Ver mis solicitudes <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </li>
          <li>
            <span className="how-process-step__number">04</span>
            <span className="how-process-step__icon">
              <CircleCheckBig aria-hidden="true" />
            </span>
            <div className="how-process-step__copy">
              <h3>Revisa la respuesta</h3>
              <p>
                La solución, los cambios de estado y la conversación quedan
                disponibles en el historial de tu solicitud.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section
        className="how-process-status"
        aria-labelledby="how-process-status-title"
      >
        <div className="how-process-status__inner">
          <div className="how-process-status__main">
            <h2 id="how-process-status-title">
              El estado te ayuda a saber qué sigue.
            </h2>
            <p>
              Consulta el detalle y el historial para entender en qué punto está
              tu solicitud. Si el equipo necesita información, podrás continuar
              desde la misma conversación.
            </p>
            <ol
              className="how-process-status__flow"
              aria-label="Estados posibles de una solicitud"
            >
              <li className="how-process-status__stage">
                <span className="how-process-status__number" aria-hidden="true">
                  01
                </span>
                <div>
                  <p className="how-process-status__state">
                    Disponible · Por atender
                  </p>
                  <h3>Solicitud recibida</h3>
                  <p>
                    Tu caso quedó registrado y el equipo lo tomará para iniciar
                    la atención.
                  </p>
                </div>
              </li>
              <li className="how-process-status__stage">
                <span className="how-process-status__number" aria-hidden="true">
                  02
                </span>
                <div>
                  <p className="how-process-status__state">En atención</p>
                  <h3>El equipo revisa tu caso</h3>
                  <p>
                    Consulta los avances y responde en el mismo hilo si te
                    solicitan información.
                  </p>
                </div>
              </li>
              <li className="how-process-status__stage">
                <span className="how-process-status__number" aria-hidden="true">
                  03
                </span>
                <div>
                  <p className="how-process-status__state">
                    Esperando al cliente
                  </p>
                  <h3>Hace falta tu respuesta</h3>
                  <p>
                    Comparte el dato solicitado para que el equipo pueda
                    continuar con la gestión.
                  </p>
                </div>
              </li>
              <li className="how-process-status__stage">
                <span className="how-process-status__number" aria-hidden="true">
                  04
                </span>
                <div>
                  <p className="how-process-status__state">
                    Resuelto por cerrar · Cerrado
                  </p>
                  <h3>La respuesta queda en tu historial</h3>
                  <p>
                    La solución y la conversación permanecen disponibles en el
                    detalle de la solicitud.
                  </p>
                </div>
              </li>
            </ol>
            <p className="how-process-status__caption">
              Si un caso se cancela, el historial conserva los comentarios,
              archivos y actividad registrados.
            </p>
          </div>
          <aside className="how-process-status__aside">
            <span className="how-process-status__aside-icon">
              <Clock3 aria-hidden="true" />
            </span>
            <h3>Los tiempos se consultan junto al caso.</h3>
            <p>
              Cuando hay información de SLA disponible, puedes revisar los
              tiempos de atención desde el detalle de la solicitud.
            </p>
            <Link to="/ingresar?returnTo=%2Fapp%2Fsolicitudes">
              Consultar mis solicitudes <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>

      <section
        className="how-process-operations"
        aria-labelledby="how-process-operations-title"
      >
        <div className="how-process-operations__visual">
          <ResponsiveImage
            name="human-support"
            alt="Una persona recibe orientación de un asesor en una conversación presencial."
            className="how-process-operations__picture"
          />
        </div>
        <div className="how-process-operations__content">
          <h2 id="how-process-operations-title">
            Una operación coordinada detrás de cada respuesta.
          </h2>
          <p>
            El equipo trabaja sobre la misma solicitud para organizar la
            atención, mantener el historial y dar continuidad a la conversación.
          </p>
          <div className="how-process-roles">
            <article>
              <span aria-hidden="true">
                <Headphones />
              </span>
              <div>
                <h3>Asesores</h3>
                <p>
                  Revisan la bandeja, atienden casos asignados, actualizan el
                  estado y solicitan información cuando hace falta.
                </p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">
                <ShieldCheck />
              </span>
              <div>
                <h3>Supervisión</h3>
                <p>
                  Organiza asignaciones y tiempos de atención, y administra el
                  conocimiento, los reportes y la auditoría operativa.
                </p>
              </div>
            </article>
          </div>
          <p className="how-process-operations__note">
            El asistente ofrece orientación inicial; la atención del equipo se
            gestiona desde la solicitud y no en un chat en tiempo real.
          </p>
        </div>
      </section>

      <section className="how-process-cta" aria-labelledby="how-process-cta-title">
        <div>
          <h2 id="how-process-cta-title">Empieza por el paso que necesitas.</h2>
          <p>
            Registra una solicitud, revisa una respuesta o conversa con el
            asistente para orientarte.
          </p>
        </div>
        <div className="how-process-cta__actions">
          <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
          <Button
            className="how-process-cta__assistant"
            variant="secondary"
            onClick={requestOpenPublicAssistant}
          >
            <Bot aria-hidden="true" /> Abrir asistente
          </Button>
          <Link
            className="how-process-cta__tracking"
            to="/ingresar?returnTo=%2Fapp%2Fsolicitudes"
          >
            Ya tengo una solicitud <ArrowDownRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
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
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <ResponsiveImage
          name="human-support"
          alt="Dos personas conversan en un espacio de atención"
          className="about-hero__media"
        />
        <div className="about-hero__shade" />
        <div className="about-hero__content">
          <p className="about-eyebrow">Acerca de esta experiencia</p>
          <h1 id="about-title">Sobre el proyecto</h1>
          <p className="about-hero__intro">
            Una demostración académica de cómo podría organizarse la atención y
            el seguimiento de solicitudes en un canal digital.
          </p>
          <div className="about-actions">
            <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
            <ButtonLink to="/preguntas-frecuentes" variant="secondary">
              Ir a preguntas frecuentes
            </ButtonLink>
          </div>
          <p className="about-hero__note">
            Un recorrido visual de una propuesta académica.
          </p>
        </div>
      </section>

      <Reveal className="about-intro">
        <div className="about-heading">
          <p className="about-eyebrow">Propósito</p>
          <h2>Un prototipo académico de atención digital</h2>
        </div>
        <div className="about-intro__copy">
          <p>
            El proyecto permite recorrer una experiencia de orientación,
            registro y seguimiento de tickets con contenido de demostración.
          </p>
          <p>
            Sus pantallas sirven para explorar flujos de atención y no representan
            productos ni canales de una institución financiera.
          </p>
        </div>
      </Reveal>

      <Reveal className="about-history">
        <div className="about-heading about-heading--inverse">
          <p className="about-eyebrow">Recorrido de demostración</p>
          <h2>Cómo funciona el recorrido</h2>
        </div>
        <ol className="about-history__timeline">
          <li>
            <strong>01 · Orientación</strong>
            <span>Explora preguntas frecuentes o temas de ayuda.</span>
          </li>
          <li>
            <strong>02 · Registro</strong>
            <span>Revisa el flujo de creación de una solicitud de prueba.</span>
          </li>
          <li>
            <strong>03 · Seguimiento</strong>
            <span>Consulta estados y conversaciones de ejemplo.</span>
          </li>
          <li>
            <strong>04 · Aprendizaje</strong>
            <span>Observa cómo se organiza el contexto de atención.</span>
          </li>
        </ol>
      </Reveal>

      <section
        className="about-segments"
        aria-label="Funciones demostradas"
      >
        <div className="about-segments__heading">
          <p className="about-eyebrow">Funciones</p>
          <h2>Explora las partes principales del prototipo</h2>
        </div>
        <div className="about-segments__stories">
          <Reveal className="about-segment about-segment--personal">
            <ResponsiveImage
              name="personal-banking"
              alt="Una persona consulta información en una pantalla"
              className="about-segment__media"
            />
            <div className="about-segment__copy">
              <span aria-hidden="true">01</span>
              <h3>Orientación para cada consulta</h3>
              <p>
                Revisa temas y preguntas de ejemplo; el contenido financiero no
                sustituye información verificada de una entidad.
              </p>
            </div>
          </Reveal>
          <Reveal className="about-segment about-segment--business">
            <ResponsiveImage
              name="business-banking"
              alt="Un equipo revisa información en una mesa de trabajo"
              className="about-segment__media"
            />
            <div className="about-segment__copy">
              <span aria-hidden="true">02</span>
              <h3>Seguimiento de tickets</h3>
              <p>
                Explora el historial, los estados y las opciones que ofrece el
                flujo de solicitudes de demostración.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <Reveal className="about-service">
        <div className="about-service__content">
          <p className="about-eyebrow">Alcance</p>
          <h2>Explora el prototipo</h2>
          <p>
            Navega por las preguntas frecuentes, el recorrido de ayuda y las
            pantallas de tickets para conocer la propuesta académica.
          </p>
          <ul>
            <li>Orientación mediante preguntas de ejemplo</li>
            <li>Registro y seguimiento dentro de la demostración</li>
            <li>Diseño de conversación con contexto</li>
          </ul>
        </div>
        <ResponsiveImage
          name="service-architecture"
          alt="Diagrama abstracto de un recorrido digital"
          className="about-service__media"
        />
      </Reveal>

      <Reveal className="about-closing">
        <div>
          <p className="about-eyebrow">Prueba de navegación</p>
          <h2>Continúa explorando</h2>
          <p>
            Este prototipo presenta un recorrido académico y no representa un
            canal oficial de una entidad financiera.
          </p>
        </div>
        <div className="about-actions">
          <ButtonLink to="/registro">Crear una solicitud</ButtonLink>
          <ButtonLink to="/preguntas-frecuentes" variant="secondary">
            Ir a preguntas frecuentes
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  );
}

export function HelpPage() {
  return (
    <div className="help-page">
      <section className="help-hero" aria-labelledby="help-page-title">
        <div className="help-hero__copy">
          <h1 id="help-page-title">Encuentra el siguiente paso.</h1>
          <p className="help-hero__lead">
            Resuelve una duda, conversa con el asistente o registra un caso. Si
            necesitas atención del equipo, continúa desde el historial de tu
            solicitud.
          </p>
          <ul className="help-hero__signals" aria-label="Opciones de ayuda">
            <li>
              <BookOpenCheck aria-hidden="true" />
              <span>Orientación por tema</span>
            </li>
            <li>
              <MessagesSquare aria-hidden="true" />
              <span>Seguimiento en un mismo caso</span>
            </li>
          </ul>
        </div>
        <figure className="help-hero__visual">
          <ResponsiveImage
            name="human-support"
            alt="Un asesor conversa con una persona y revisan información juntos."
            className="help-hero__image"
          />
        </figure>
      </section>

      <section className="help-choices" aria-labelledby="help-choices-title">
        <div className="help-choices__inner">
          <header className="help-choices__heading">
            <h2 id="help-choices-title">¿Qué necesitas resolver?</h2>
            <p>
              Empieza por una respuesta inmediata o continúa con el equipo en
              una solicitud que conserva todo el contexto.
            </p>
          </header>

          <div className="help-choice-list">
            <article className="help-choice">
              <span className="help-choice__icon" aria-hidden="true">
                <BookOpenCheck />
              </span>
              <div className="help-choice__content">
                <h3>Orientación para una duda</h3>
                <p>
                  Explora respuestas por tema o conversa con el asistente para
                  encontrar el siguiente paso antes de registrar un caso.
                </p>
                <p className="help-choice__detail">
                  <CircleCheckBig aria-hidden="true" />
                  Respuestas frecuentes y orientación inicial, en un solo lugar.
                </p>
              </div>
              <div className="help-choice__actions">
                <ButtonLink to="/preguntas-frecuentes" variant="secondary">
                  Ver preguntas frecuentes
                </ButtonLink>
                <Button
                  className="help-choice__assistant"
                  variant="quiet"
                  onClick={requestOpenPublicAssistant}
                >
                  <Bot aria-hidden="true" /> Abrir asistente
                </Button>
              </div>
            </article>

            <article className="help-choice">
              <span className="help-choice__icon help-choice__icon--case" aria-hidden="true">
                <ClipboardList />
              </span>
              <div className="help-choice__content">
                <h3>Atención humana y seguimiento</h3>
                <p>
                  Registra tu consulta para que el equipo la atienda y vuelve a
                  esa misma solicitud para revisar avances o responder.
                </p>
                <p className="help-choice__detail">
                  <MessagesSquare aria-hidden="true" />
                  Mensajes, archivos y cambios de estado permanecen en el
                  historial; los tiempos se muestran cuando están disponibles.
                </p>
              </div>
              <div className="help-choice__actions">
                <ButtonLink to="/registro">Registrar una solicitud</ButtonLink>
                <Link
                  className="help-choice__tracking"
                  to="/ingresar?returnTo=%2Fapp%2Fsolicitudes"
                >
                  Consultar mis solicitudes <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}

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
