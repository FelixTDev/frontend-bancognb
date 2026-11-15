import { Bot, MessageCircleMore, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AssistantConversation } from "./assistant-conversation";
import { useModalFocus } from "../../shared/hooks/use-modal-focus";

const openAssistantEvent = "gnb:open-public-assistant";

export function requestOpenPublicAssistant() {
  window.dispatchEvent(new Event(openAssistantEvent));
}

export function PublicAssistantWidget() {
  const [isOpen, setOpen] = useState(false);
  const [isObstructed, setObstructed] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(openAssistantEvent, handleOpen);
    return () => window.removeEventListener(openAssistantEvent, handleOpen);
  }, []);

  useEffect(() => {
    const selector = ".closing-cta, .how-process-cta, .help-choices, .footer";
    let frame = 0;
    const updateVisibility = () => {
      const hasVisibleTarget = Array.from(
        document.querySelectorAll(selector),
      ).some((target) => {
        const bounds = target.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom > 0;
      });
      setObstructed(hasVisibleTarget);
    };
    const scheduleVisibilityUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateVisibility);
    };
    const mutations = new MutationObserver(scheduleVisibilityUpdate);

    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", scheduleVisibilityUpdate, {
      passive: true,
    });
    window.addEventListener("resize", scheduleVisibilityUpdate);
    scheduleVisibilityUpdate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleVisibilityUpdate);
      window.removeEventListener("resize", scheduleVisibilityUpdate);
      mutations.disconnect();
    };
  }, []);

  return (
    <div
      className={`assistant-widget${isObstructed && !isOpen ? " assistant-widget--obstructed" : ""}${isOpen ? " assistant-widget--open" : ""}`}
    >
      {isOpen ? <WidgetDialog onClose={() => setOpen(false)} /> : null}
      {!isOpen ? (
        <button
          type="button"
          className="assistant-widget__launcher"
          aria-label="Abrir Asistente GNB"
          aria-expanded={false}
          aria-controls="assistant-widget-dialog"
          onClick={() => setOpen(true)}
        >
          <MessageCircleMore aria-hidden="true" />
          <span>Asistente GNB</span>
        </button>
      ) : null}
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
          <strong id="assistant-widget-title">Asistente GNB</strong>
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
