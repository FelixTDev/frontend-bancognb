import { Bot, MessageCircleMore, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AssistantConversation } from "./assistant-conversation";
import { useModalFocus } from "../../shared/hooks/use-modal-focus";

export function PublicAssistantWidget() {
  const [isOpen, setOpen] = useState(false);
  const [isObstructed, setObstructed] = useState(false);

  useEffect(() => {
    const targets = document.querySelectorAll(".closing-cta, .footer");
    const observer = new IntersectionObserver(
      (entries) => setObstructed(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`assistant-widget${isObstructed && !isOpen ? " assistant-widget--obstructed" : ""}`}
    >
      {isOpen ? <WidgetDialog onClose={() => setOpen(false)} /> : null}
      <button
        type="button"
        className="assistant-widget__launcher"
        aria-label="Abrir Asistente GNB"
        aria-expanded={isOpen}
        aria-controls="assistant-widget-dialog"
        onClick={() => setOpen(true)}
      >
        <MessageCircleMore aria-hidden="true" />
        <span>Asistente GNB</span>
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
