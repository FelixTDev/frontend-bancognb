import { Bot, MessageCircleMore, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AssistantConversation } from "./assistant-conversation";
import { useModalFocus } from "../../shared/hooks/use-modal-focus";

const openAssistantEvent = "gnb:open-public-assistant";
type WidgetPlacement =
  | "bottom-right"
  | "top-right"
  | "middle-right"
  | "bottom-left"
  | "top-left"
  | "middle-left";
const formPages = new Set([
  "/ingresar",
  "/registro",
  "/recuperar-acceso",
  "/restablecer-acceso",
  "/verificar-cuenta",
]);

export function requestOpenPublicAssistant() {
  window.dispatchEvent(new Event(openAssistantEvent));
}

export function PublicAssistantWidget() {
  const { pathname } = useLocation();
  const isAuthenticatedPortal = /^\/(?:app|asesor|supervisor)(?:\/|$)/u.test(
    pathname,
  );
  const isDedicatedAssistantPage = pathname === "/app/asistente";
  const isFormPage = formPages.has(pathname);
  const [isWidgetOpen, setWidgetOpen] = useState(false);
  const [placement, setPlacement] = useState<WidgetPlacement>("bottom-right");
  const isOpen = isWidgetOpen && !isDedicatedAssistantPage && !isFormPage;
  const [isObstructed, setObstructed] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (wasOpen.current && !isOpen) launcherRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (isAuthenticatedPortal) return;
    const handleOpen = () => setWidgetOpen(true);
    window.addEventListener(openAssistantEvent, handleOpen);
    return () => window.removeEventListener(openAssistantEvent, handleOpen);
  }, [isAuthenticatedPortal]);

  useEffect(() => {
    if (!isAuthenticatedPortal && !isDedicatedAssistantPage && !isFormPage)
      return;
    const frame = window.requestAnimationFrame(() => setWidgetOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isAuthenticatedPortal, isDedicatedAssistantPage, isFormPage]);

  useEffect(() => {
    if (isAuthenticatedPortal || isDedicatedAssistantPage) return;

    let frame = 0;
    let active = true;
    const updateVisibility = () => {
      if (isOpen) {
        setObstructed(false);
        return;
      }

      const launcher = launcherRef.current;
      if (!launcher) return;
      const bounds = launcher.getBoundingClientRect();
      const margin = 4;
      const mobile = window.innerWidth <= 760;
      const edge = mobile ? 12 : 24;
      const bottomInset = mobile ? 12 : 24;
      const topInset = mobile ? 78 : 24;
      const right = window.innerWidth - edge - bounds.width;
      const bottom = window.innerHeight - bottomInset - bounds.height;
      const middle = (window.innerHeight - bounds.height) / 2;
      const placements: readonly {
        readonly key: WidgetPlacement;
        readonly left: number;
        readonly top: number;
      }[] = [
        { key: "bottom-right", left: right, top: bottom },
        { key: "top-right", left: right, top: topInset },
        { key: "bottom-left", left: edge, top: bottom },
        { key: "top-left", left: edge, top: topInset },
        { key: "middle-right", left: right, top: middle },
        { key: "middle-left", left: edge, top: middle },
      ];
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const placementIsSafe = ({ left, top }: (typeof placements)[number]) =>
        controls.every((control) => {
          if (
            control.closest(".assistant-widget") ||
            !control.getClientRects().length ||
            control.closest('[aria-hidden="true"]') ||
            window.getComputedStyle(control).visibility === "hidden"
          ) {
            return true;
          }
          const controlBounds = control.getBoundingClientRect();
          return !(
            controlBounds.left < left + bounds.width + margin &&
            controlBounds.right > left - margin &&
            controlBounds.top < top + bounds.height + margin &&
            controlBounds.bottom > top - margin
          );
        });
      const safePlacement = placements.find(placementIsSafe);
      if (safePlacement) {
        setPlacement(safePlacement.key);
        setObstructed(false);
      } else {
        setObstructed(true);
      }
    };
    const scheduleVisibilityUpdate = () => {
      if (!active) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateVisibility);
    };
    const mutations = new MutationObserver(scheduleVisibilityUpdate);
    const layoutObserver = new ResizeObserver(scheduleVisibilityUpdate);

    mutations.observe(document.body, { childList: true, subtree: true });
    layoutObserver.observe(document.documentElement);
    layoutObserver.observe(document.body);
    const appRoot = document.getElementById("root");
    if (appRoot) layoutObserver.observe(appRoot);
    void document.fonts.ready.then(scheduleVisibilityUpdate);
    window.addEventListener("scroll", scheduleVisibilityUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleVisibilityUpdate);
    scheduleVisibilityUpdate();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleVisibilityUpdate);
      window.removeEventListener("resize", scheduleVisibilityUpdate);
      mutations.disconnect();
      layoutObserver.disconnect();
    };
  }, [isAuthenticatedPortal, isDedicatedAssistantPage, isOpen, pathname]);

  if (isAuthenticatedPortal) return null;

  return (
    <div
      className={`assistant-widget assistant-widget--${placement}${pathname === "/ayuda" ? " assistant-widget--compact" : ""}${isObstructed && !isOpen ? " assistant-widget--obstructed" : ""}${isOpen ? " assistant-widget--open" : ""}`}
      aria-hidden={isObstructed && !isOpen ? true : undefined}
    >
      {isOpen ? <WidgetDialog onClose={() => setWidgetOpen(false)} /> : null}
      <button
        ref={launcherRef}
        type="button"
        className="assistant-widget__launcher"
        aria-label="Abrir asistente de atención"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "assistant-widget-dialog" : undefined}
        tabIndex={isObstructed && !isOpen ? -1 : undefined}
        hidden={isOpen}
        onClick={() => setWidgetOpen(true)}
      >
        <MessageCircleMore aria-hidden="true" />
        <span>Asistente de atención</span>
      </button>
    </div>
  );
}

function WidgetDialog({ onClose }: { readonly onClose: () => void }) {
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  return (
    <section
      id="assistant-widget-dialog"
      ref={dialogRef}
      className="assistant-widget__dialog"
      role="dialog"
      aria-labelledby="assistant-widget-title"
    >
      <header className="assistant-widget__head">
        <span aria-hidden="true">
          <Bot />
        </span>
        <div>
          <strong id="assistant-widget-title">Asistente de atención</strong>
          <small>Orientación antes de registrarte</small>
        </div>
        <button type="button" aria-label="Cerrar asistente" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <AssistantConversation authenticated={false} variant="widget" />
    </section>
  );
}
