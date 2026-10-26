import {
  BookOpenCheck,
  Headphones,
  HelpCircle,
  MessageCircleQuestion,
} from "lucide-react";

export function FaqPageHero({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <header className="faq-page-hero">
      <div className="faq-page-hero__copy">
        <p className="faq-page-hero__eyebrow">
          <HelpCircle aria-hidden="true" /> Centro de ayuda
        </p>
        <h1>{title}</h1>
        <p className="faq-page-hero__description">{description}</p>
        <p className="faq-page-hero__hint">
          Busca por tema o explora las categorías para encontrar una respuesta.
        </p>
      </div>
      <div className="faq-page-hero__art" aria-hidden="true">
        <div className="faq-page-hero__orbit" />
        <div className="faq-page-hero__medallion">
          <MessageCircleQuestion />
        </div>
        <div className="faq-page-hero__tile faq-page-hero__tile--top">
          <span className="faq-page-hero__tile-icon faq-page-hero__tile-icon--blue">
            <BookOpenCheck />
          </span>
          <span>Respuestas claras</span>
        </div>
        <div className="faq-page-hero__tile faq-page-hero__tile--bottom">
          <span className="faq-page-hero__tile-icon faq-page-hero__tile-icon--gold">
            <Headphones />
          </span>
          <span>Atención cercana</span>
        </div>
      </div>
    </header>
  );
}
