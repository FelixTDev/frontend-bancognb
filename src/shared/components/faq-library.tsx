import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  CircleHelp,
  Headphones,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/endpoints";
import { getSafeFaqContent, isExcludedFaq } from "../faq-content";
import type { Category, Faq, PageResult } from "../types/domain";
import { PaginationControls, Skeleton, StatePanel } from "./ui";

type FaqLibraryAudience = "client" | "public";

const pageItems = (
  data: readonly Faq[] | PageResult<Faq> | undefined,
): readonly Faq[] => (data ? ("items" in data ? data.items : data) : []);

const pageTotal = (
  data: readonly Faq[] | PageResult<Faq> | undefined,
  items: readonly Faq[],
) => (data && "items" in data ? data.total : items.length);

const pageCount = (
  data: readonly Faq[] | PageResult<Faq> | undefined,
  total: number,
) =>
  data && "items" in data
    ? Math.ceil(total / Math.max(data.page_size, 1))
    : 1;

const knownCategoryLabels: Readonly<Record<string, string>> = {
  TARJETAS: "Tarjetas",
  CUENTAS: "Cuentas",
  CREDITOS: "Créditos",
  BANCA_DIGITAL: "Banca digital",
  RECLAMOS_SIMPLES: "Reclamos simples",
  SOLICITUDES_INFORMACION: "Solicitudes de información",
};

const categoryLabel = (category: Category) =>
  knownCategoryLabels[category.name] ??
  category.name
    .replace(/[_-]+/g, " ")
    .toLocaleLowerCase("es-PE")
    .replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("es-PE"));

export function FaqLibrary({
  audience,
}: {
  readonly audience: FaqLibraryAudience;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["faqs", audience, search.trim(), categoryId, page],
    queryFn: () =>
      api.faqs.list({
        page,
        page_size: 100,
        search: search.trim() || undefined,
        category_id: categoryId || undefined,
      }),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });
  const responseFaqs = pageItems(query.data);
  const faqs = responseFaqs.filter((faq) => !isExcludedFaq(faq));
  const total = Math.max(
    0,
    pageTotal(query.data, responseFaqs) + faqs.length - responseFaqs.length,
  );
  const pages = pageCount(query.data, total);
  const categories =
    categoriesQuery.data?.filter((category) => category.is_active) ?? [];

  return (
    <section
      className={`faq-browser faq-browser--${audience}`}
      aria-label="Preguntas frecuentes"
    >
      <div className="faq-browser__main">
      <div className="faq-browser__controls">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Buscar preguntas frecuentes</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por tema o palabra clave…"
            autoComplete="off"
            aria-describedby="faq-search-help"
          />
        </label>
        <p id="faq-search-help" className="faq-browser__search-help">
          Busca en el contenido publicado.
        </p>
        {categories.length ? (
          <div
            className="faq-browser__categories"
            role="group"
            aria-label="Filtrar por categoría"
          >
            <button
              type="button"
              aria-pressed={!categoryId}
              onClick={() => {
                setCategoryId("");
                setPage(1);
              }}
            >
              Todos los temas
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={categoryId === category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  setPage(1);
                }}
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {query.isLoading ? (
        <Skeleton rows={7} />
      ) : query.isError ? (
        <StatePanel
          kind="error"
          title="No pudimos consultar las preguntas frecuentes"
          message="Revisa tu conexión e inténtalo nuevamente."
          actionLabel="Reintentar"
          onAction={() => void query.refetch()}
        />
      ) : faqs.length ? (
        <>
          <div className="faq-browser__result-count" aria-live="polite">
            <BookOpenCheck aria-hidden="true" />
            {total === 1 ? "1 pregunta" : `${total} preguntas`}
          </div>
          <div className="faq-list">
            {faqs.map((faq) => {
              const content = getSafeFaqContent(faq);
              return (
                <details key={faq.id} name="faq-items">
                  <summary>
                    <span className="faq-browser__question">
                      <CircleHelp aria-hidden="true" />
                      <span>{content.question}</span>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <p>{content.answer}</p>
                </details>
              );
            })}
          </div>
          {pages > 1 ? (
            <PaginationControls
              page={page}
              totalPages={pages}
              total={total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : (
        <StatePanel
          kind="empty"
          title="No encontramos coincidencias"
          message="Prueba con términos más generales o elige otra categoría."
        />
      )}
      </div>

      <aside className="faq-help-card">
        <span className="faq-help-card__icon">
          <Headphones aria-hidden="true" />
        </span>
        <p className="faq-help-card__eyebrow">¿Necesitas más ayuda?</p>
        <h2>Te orientamos en el siguiente paso.</h2>
        <p className="faq-help-card__description">
          {audience === "public"
            ? "Revisa los canales de atención disponibles para recibir orientación."
            : "Consulta al asistente digital o revisa el avance de tus solicitudes."}
        </p>
        <Link
          className="faq-help-card__link"
          to={audience === "public" ? "/ayuda" : "/app/asistente"}
        >
          {audience === "public" ? "Ver canales de atención" : "Ir al asistente"}
          <ArrowRight aria-hidden="true" />
        </Link>
        <div className="faq-help-card__note">
          <ShieldCheck aria-hidden="true" />
          <span>Atención digital con el contexto de tu consulta.</span>
        </div>
      </aside>
    </section>
  );
}
