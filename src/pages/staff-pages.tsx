import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  ChevronRight,
  CirclePlus,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileClock,
  Filter,
  Gauge,
  ListFilter,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  UserCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../shared/api/endpoints";
import { ApiError } from "../shared/api/http";
import { formatCategoryDisplayName } from "../shared/ticket-labels";
import {
  Button,
  PageIntro,
  PaginationControls,
  PriorityBadge,
  Skeleton,
  StatePanel,
  StatusBadge,
} from "../shared/components/ui";
import { useModalFocus } from "../shared/hooks/use-modal-focus";
import type { Category, Faq, PageResult, Ticket } from "../shared/types/domain";

const ticketsFromUnknown = (value: unknown): readonly Ticket[] => {
  if (Array.isArray(value)) return value as readonly Ticket[];
  if (
    value &&
    typeof value === "object" &&
    "items" in value &&
    Array.isArray(value.items)
  )
    return (value as { items: readonly Ticket[] }).items;
  return [];
};
const totalFromUnknown = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object" && "total" in value)
    return Number(value.total) || 0;
  return 0;
};
const totalPagesFromUnknown = (value: unknown): number => {
  if (!value || typeof value !== "object") return 1;
  if ("total_pages" in value) return Number(value.total_pages) || 1;
  if ("pages" in value) return Number(value.pages) || 1;
  if ("total" in value && "page_size" in value)
    return Math.max(
      1,
      Math.ceil(Number(value.total) / Math.max(1, Number(value.page_size))),
    );
  return 1;
};
const faqsFromUnknown = (value: unknown): readonly Faq[] =>
  value && typeof value === "object" && "items" in value
    ? (value as PageResult<Faq>).items
    : Array.isArray(value)
      ? (value as readonly Faq[])
      : [];
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export function AdvisorDashboardPage() {
  const assigned = useQuery({
    queryKey: ["operations", "assigned"],
    queryFn: () =>
      api.tickets.operations({
        queue: "assigned_to_me",
        page: 1,
        page_size: 8,
      }),
  });
  const urgent = useQuery({
    queryKey: ["operations", "sla-soon"],
    queryFn: () =>
      api.tickets.operations({ queue: "sla_soon", page: 1, page_size: 8 }),
  });
  const pending = useQuery({
    queryKey: ["operations", "assigned", "pending-client"],
    queryFn: () =>
      api.tickets.operations({
        queue: "assigned_to_me",
        status: "PENDIENTE_CLIENTE",
        page: 1,
        page_size: 1,
      }),
  });
  const tickets = ticketsFromUnknown(assigned.data);
  return (
    <>
      <PageIntro
        title="Panel de atención"
        description="Prioriza la bandeja por urgencia, contexto y tiempo restante."
        actions={
          <Link className="button button--secondary" to="/asesor/bandeja">
            <ListFilter aria-hidden="true" />
            Abrir bandeja
          </Link>
        }
      />
      <section className="dashboard-summary">
        <article>
          <span>Asignados</span>
          <strong>{totalFromUnknown(assigned.data)}</strong>
          <p>Tickets visibles en tu bandeja.</p>
        </article>
        <article>
          <span>Próximos a vencer</span>
          <strong>{totalFromUnknown(urgent.data)}</strong>
          <p>Requieren revisión prioritaria.</p>
        </article>
        <article>
          <span>En espera del cliente</span>
          <strong>{totalFromUnknown(pending.data)}</strong>
          <p>Conservan el seguimiento activo.</p>
        </article>
      </section>
      <section className="content-section">
        <div className="section-bar">
          <div>
            <h2>Trabajo inmediato</h2>
            <p>Ordenado por la actividad más reciente.</p>
          </div>
        </div>
        {assigned.isLoading ? (
          <Skeleton rows={6} />
        ) : assigned.isError ? (
          <PermissionAwareError
            error={assigned.error}
            retry={() => void assigned.refetch()}
          />
        ) : tickets.length ? (
          <OperationalTable tickets={tickets} basePath="/asesor/tickets" />
        ) : (
          <StatePanel
            kind="empty"
            title="No tienes tickets asignados"
            message="Consulta la cola disponible para tomar un caso."
          />
        )}
      </section>
    </>
  );
}

export function AdvisorInboxPage() {
  return (
    <OperationalTicketsPage
      title="Bandeja de atención"
      description="Busca, filtra y atiende los tickets asignados o disponibles."
      basePath="/asesor/tickets"
      advisor
    />
  );
}

export function KnowledgePage() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["faqs", "staff", search],
    queryFn: () => api.faqs.list({ page: 1, page_size: 50, search }),
  });
  const faqs = faqsFromUnknown(query.data);
  return (
    <>
      <PageIntro
        title="Respuestas para tus clientes"
        description="Encuentra orientación clara para acompañar cada consulta."
      />
      <label className="search-field staff-knowledge-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Buscar respuestas</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Busca por pregunta, tema o palabra clave…"
          autoComplete="off"
        />
      </label>
      {query.isLoading ? (
        <Skeleton rows={7} />
      ) : faqs.length ? (
        <div className="knowledge-list">
          {faqs.map((faq) => (
            <article
              key={faq.id}
              className={
                faq.tags.length > 0
                  ? "knowledge-list__item--with-topics"
                  : undefined
              }
            >
              <span className="knowledge-list__icon">
                <BookOpenCheck aria-hidden="true" />
              </span>
              <div className="knowledge-list__content">
                <h2>{faq.title}</h2>
                <p>{faq.summary || faq.answer}</p>
              </div>
              {faq.tags.length > 0 && (
                <div className="knowledge-list__topics">
                  <span className="knowledge-list__topics-label">
                    Temas relacionados
                  </span>
                  <div className="knowledge-list__topic-list">
                    {faq.tags.map((tag) => (
                      <span key={tag}>{formatKnowledgeTag(tag)}</span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <StatePanel
          kind="empty"
          title="No encontramos respuestas"
          message="Prueba con otra palabra o con un tema relacionado."
        />
      )}
    </>
  );
}

function formatKnowledgeTag(tag: string) {
  const normalized = tag.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return tag;
  return normalized.charAt(0).toLocaleUpperCase("es-PE") + normalized.slice(1);
}

export function SupervisorDashboardPage() {
  const summary = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => api.reports.summary(),
  });
  const queue = useQuery({
    queryKey: ["operations", "supervisor", "recent"],
    queryFn: () =>
      api.tickets.operations({
        queue: "recently_updated",
        page: 1,
        page_size: 6,
      }),
  });
  const report = summary.data as Record<string, number> | undefined;
  return (
    <>
      <PageIntro
        title="Operación"
        description="Una vista ejecutiva de la cola, los tiempos y la capacidad de atención."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void summary.refetch();
              void queue.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" />
            Actualizar
          </Button>
        }
      />
      <section className="dashboard-summary">
        <article>
          <span>Tickets abiertos</span>
          <strong>{report?.open_tickets ?? report?.total_open ?? "—"}</strong>
          <p>Activos en la operación.</p>
        </article>
        <article>
          <span>Pendientes del cliente</span>
          <strong>{report?.pending_client_tickets ?? "—"}</strong>
          <p>En espera de información.</p>
        </article>
        <article>
          <span>Tickets resueltos</span>
          <strong>{report?.resolved_tickets ?? "—"}</strong>
          <p>Dentro del rango consultado.</p>
        </article>
      </section>
      <section className="operations-split">
        <div className="content-section">
          <div className="section-bar">
            <div>
              <h2>Actividad reciente</h2>
              <p>Cambios que requieren contexto operativo.</p>
            </div>
            <Link to="/supervisor/cola">
              Ver cola <ChevronRight aria-hidden="true" />
            </Link>
          </div>
          {queue.isLoading ? (
            <Skeleton rows={6} />
          ) : (
            <OperationalTable
              tickets={ticketsFromUnknown(queue.data)}
              basePath="/supervisor/tickets"
            />
          )}
        </div>
        <aside className="attention-panel">
          <Gauge aria-hidden="true" />
          <h2>Control de SLA</h2>
          <p>Revisa políticas, pausas y vencimientos desde un solo módulo.</p>
          <Link to="/supervisor/sla">Administrar SLA</Link>
        </aside>
      </section>
    </>
  );
}

export function SupervisorQueuePage() {
  return (
    <OperationalTicketsPage
      title="Cola de tickets"
      description="Filtra la operación y abre cada caso con su contexto completo."
      basePath="/supervisor/tickets"
    />
  );
}

function OperationalTicketsPage({
  title,
  description,
  basePath,
  advisor = false,
}: {
  readonly title: string;
  readonly description: string;
  readonly basePath: string;
  readonly advisor?: boolean;
}) {
  const [queue, setQueue] = useState(
    advisor ? "assigned_to_me" : "recently_updated",
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["operations", queue, search, page],
    queryFn: () =>
      api.tickets.operations({ queue, search, page, page_size: 20 }),
  });
  const tickets = ticketsFromUnknown(query.data);
  return (
    <>
      <PageIntro title={title} description={description} />
      <div className="filters">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Buscar tickets</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Código, asunto o cliente…"
            autoComplete="off"
          />
        </label>
        <label>
          <Filter aria-hidden="true" />
          <span className="sr-only">Seleccionar cola</span>
          <select
            value={queue}
            onChange={(event) => {
              setQueue(event.target.value);
              setPage(1);
            }}
          >
            <option value="assigned_to_me">Asignados a mí</option>
            <option value="unassigned">Sin asignar</option>
            {advisor ? null : (
              <option value="assigned_to_advisor">Asignados a asesor</option>
            )}
            <option value="sla_soon">SLA próximo</option>
            <option value="sla_overdue">SLA vencido</option>
            <option value="pending_first_response">
              Primera respuesta pendiente
            </option>
            <option value="recently_updated">Actualizados recientemente</option>
          </select>
        </label>
      </div>
      {query.isLoading ? (
        <Skeleton rows={8} />
      ) : query.isError ? (
        <PermissionAwareError
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : tickets.length ? (
        <>
          <OperationalTable tickets={tickets} basePath={basePath} />
          <PaginationControls
            page={page}
            totalPages={totalPagesFromUnknown(query.data)}
            total={totalFromUnknown(query.data)}
            onPageChange={setPage}
          />
        </>
      ) : (
        <StatePanel
          kind="empty"
          title="La cola no tiene resultados"
          message="Cambia los filtros o actualiza la búsqueda."
        />
      )}
    </>
  );
}

export function AssignmentsPage() {
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ["tickets", "unassigned", page],
    queryFn: () =>
      api.tickets.operations({ queue: "unassigned", page, page_size: 20 }),
  });
  const advisors = useQuery({
    queryKey: ["advisors"],
    queryFn: api.users.advisors,
  });
  const client = useQueryClient();
  const [advisorId, setAdvisorId] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const assignment = useMutation({
    mutationFn: async () =>
      Promise.all(
        selected.map((id) =>
          api.tickets.assign(
            id,
            advisorId,
          ),
        ),
      ),
    onSuccess: async () => {
      setSelected([]);
      await client.invalidateQueries({ queryKey: ["tickets", "unassigned"] });
    },
  });
  const tickets = ticketsFromUnknown(queue.data);
  return (
    <>
      <PageIntro
        title="Asignaciones"
        description="Distribuye tickets sin perder la trazabilidad de la decisión."
      />
      <div className="bulk-bar">
        <span>{selected.length} seleccionados</span>
        <select
          value={advisorId}
          onChange={(event) => setAdvisorId(event.target.value)}
          aria-label="Seleccionar asesor"
        >
          <option value="">Selecciona un asesor</option>
          {advisors.data?.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.full_name}
            </option>
          ))}
        </select>
        <Button
          disabled={!selected.length || !advisorId}
          isLoading={assignment.isPending}
          onClick={() => assignment.mutate()}
        >
          <UserCheck aria-hidden="true" />
          Asignar
        </Button>
      </div>
      {queue.isLoading ? (
        <Skeleton rows={8} />
      ) : tickets.length ? (
        <>
          <div className="assignment-list">
            {tickets.map((ticket) => (
              <label key={ticket.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(ticket.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, ticket.id]
                        : current.filter((id) => id !== ticket.id),
                    )
                  }
                />
                <div>
                  <strong>{ticket.tracking_code}</strong>
                  <h2>{ticket.subject}</h2>
                  <span>{formatDate(ticket.created_at)}</span>
                </div>
                <PriorityBadge priority={ticket.priority} />
              </label>
            ))}
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPagesFromUnknown(queue.data)}
            total={totalFromUnknown(queue.data)}
            onPageChange={(nextPage) => {
              setSelected([]);
              setPage(nextPage);
            }}
          />
        </>
      ) : (
        <StatePanel
          kind="empty"
          title="No hay tickets sin asignar"
          message="La cola está distribuida entre los asesores."
        />
      )}
    </>
  );
}

export function ContentManagementPage() {
  const [tab, setTab] = useState<"faqs" | "categories">("faqs");
  const [editor, setEditor] = useState<
    | { readonly kind: "faq"; readonly item?: Faq }
    | { readonly kind: "category"; readonly item?: Category }
    | null
  >(null);
  return (
    <div className="content-admin-page">
      <PageIntro
        className="content-admin-page__intro"
        title="Contenido"
        description="Administra preguntas frecuentes y categorías de atención."
        actions={
          <Button
            className="content-admin__create-button"
            onClick={() =>
              setEditor({ kind: tab === "faqs" ? "faq" : "category" })
            }
          >
            <CirclePlus aria-hidden="true" />{" "}
            Crear {tab === "faqs" ? "pregunta" : "categoría"}
          </Button>
        }
      />
      <div
        className="tabs content-admin-page__tabs"
        role="tablist"
        aria-label="Secciones de contenido"
      >
        <button
          role="tab"
          aria-selected={tab === "faqs"}
          className={tab === "faqs" ? "active" : undefined}
          onClick={() => setTab("faqs")}
        >
          <BookOpenCheck aria-hidden="true" />
          Preguntas frecuentes
        </button>
        <button
          role="tab"
          aria-selected={tab === "categories"}
          className={tab === "categories" ? "active" : undefined}
          onClick={() => setTab("categories")}
        >
          <Tags aria-hidden="true" />
          Categorías
        </button>
      </div>
      {tab === "faqs" ? (
        <FaqAdmin onEdit={(item) => setEditor({ kind: "faq", item })} />
      ) : (
        <CategoryAdmin
          onEdit={(item) => setEditor({ kind: "category", item })}
        />
      )}
      {editor ? (
        <ContentEditorDialog editor={editor} onClose={() => setEditor(null)} />
      ) : null}
    </div>
  );
}

function FaqAdmin({ onEdit }: { readonly onEdit: (item: Faq) => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["faqs", "admin"],
    queryFn: () => api.faqs.admin({ page: 1, page_size: 50 }),
  });
  const toggle = useMutation({
    mutationFn: ({
      id,
      active,
    }: {
      readonly id: string;
      readonly active: boolean;
    }) => api.faqs.setStatus(id, active),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["faqs", "admin"] }),
  });
  const faqs = faqsFromUnknown(query.data);
  if (query.isLoading) return <Skeleton rows={8} />;
  return faqs.length ? (
    <div className="admin-table content-admin-table content-admin-table--faqs">
      <div className="admin-table__head">
        <span>Pregunta</span>
        <span>Estado</span>
        <span>Versión</span>
        <span>Acción</span>
      </div>
      {faqs.map((faq) => (
        <div key={faq.id}>
          <span className="content-admin-table__faq-copy">
            <strong>{faq.title}</strong>
            {faq.summary?.trim() && faq.summary.trim() !== faq.title.trim() ? (
              <small>{faq.summary}</small>
            ) : faq.question.trim() !== faq.title.trim() ? (
              <small>{faq.question}</small>
            ) : null}
          </span>
          <span>
            <span
              className={`content-admin-status ${faq.is_active ? "content-admin-status--active" : "content-admin-status--inactive"}`}
            >
              {faq.is_active ? "Activa" : "Inactiva"}
            </span>
          </span>
          <span>
            <span className="content-admin-version">v{faq.version}</span>
          </span>
          <div className="admin-actions">
            <Button
              className="content-admin-action content-admin-action--edit"
              variant="quiet"
              onClick={() => onEdit(faq)}
            >
              <PencilLine aria-hidden="true" />
              Editar
            </Button>
            <Button
              className={`content-admin-action ${faq.is_active ? "content-admin-action--deactivate" : "content-admin-action--activate"}`}
              variant="quiet"
              onClick={() =>
                toggle.mutate({ id: faq.id, active: !faq.is_active })
              }
            >
              {faq.is_active ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
              {faq.is_active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <StatePanel
      kind="empty"
      title="No hay preguntas registradas"
      message="Crea la primera pregunta para publicar contenido."
    />
  );
}

function CategoryAdmin({
  onEdit,
}: {
  readonly onEdit: (item: Category) => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });
  const toggle = useMutation({
    mutationFn: ({
      id,
      active,
    }: {
      readonly id: string;
      readonly active: boolean;
    }) => api.categories.setStatus(id, active),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
  if (query.isLoading) return <Skeleton rows={6} />;
  return (
    <div className="admin-table content-admin-table content-admin-table--categories">
      <div className="admin-table__head">
        <span>Categoría</span>
        <span>Descripción</span>
        <span>Estado</span>
        <span>Acción</span>
      </div>
      {query.data?.map((category) => (
        <div key={category.id}>
          <strong className="content-admin-table__category-name">
            {formatCategoryDisplayName(category.name)}
          </strong>
          <span className="content-admin-table__description">
            {category.description}
          </span>
          <span>
            <span
              className={`content-admin-status ${category.is_active ? "content-admin-status--active" : "content-admin-status--inactive"}`}
            >
              {category.is_active ? "Activa" : "Inactiva"}
            </span>
          </span>
          <div className="admin-actions">
            <Button
              className="content-admin-action content-admin-action--edit"
              variant="quiet"
              onClick={() => onEdit(category)}
            >
              <PencilLine aria-hidden="true" />
              Editar
            </Button>
            <Button
              className={`content-admin-action ${category.is_active ? "content-admin-action--deactivate" : "content-admin-action--activate"}`}
              variant="quiet"
              onClick={() =>
                toggle.mutate({
                  id: category.id,
                  active: !category.is_active,
                })
              }
            >
              {category.is_active ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
              {category.is_active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContentEditorDialog({
  editor,
  onClose,
}: {
  readonly editor:
    | { readonly kind: "faq"; readonly item?: Faq }
    | { readonly kind: "category"; readonly item?: Category };
  readonly onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
    enabled: editor.kind === "faq",
  });
  const [error, setError] = useState<string | null>(null);
  const [categoryNameEdited, setCategoryNameEdited] = useState(false);
  const mutation = useMutation<
    unknown,
    Error,
    Readonly<Record<string, unknown>>
  >({
    mutationFn: (body: Readonly<Record<string, unknown>>) =>
      editor.kind === "faq"
        ? editor.item
          ? api.faqs.update(editor.item.id, body)
          : api.faqs.create(body)
        : editor.item
          ? api.categories.update(editor.item.id, body)
          : api.categories.create(body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["faqs"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      onClose();
    },
    onError: (value) =>
      setError(
        value instanceof ApiError
          ? value.message
          : "No pudimos guardar los cambios.",
      ),
  });
  const faq = editor.kind === "faq" ? editor.item : undefined;
  const category = editor.kind === "category" ? editor.item : undefined;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="editor-dialog editor-dialog--content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-dialog__head">
          <h2 id="editor-title">
            {editor.item ? "Editar" : "Crear"}{" "}
            {editor.kind === "faq" ? "pregunta" : "categoría"}
          </h2>
          <div className="content-editor-dialog__tools">
            <span>Gestión de contenido</span>
            <button
              className="icon-button"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (editor.kind === "category") {
              const name = textField(form, "name");
              mutation.mutate({
                name: category && !categoryNameEdited ? category.name : name,
                description: textField(form, "description"),
              });
              return;
            }
            mutation.mutate({
              category_id: textField(form, "category_id"),
              title: textField(form, "title") || null,
              question: textField(form, "question"),
              answer: textField(form, "answer"),
              summary: textField(form, "summary") || null,
              keywords: textField(form, "keywords"),
              tags: textField(form, "tags")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              synonyms: [],
              priority: 0,
              display_order: 0,
            });
          }}
        >
          {editor.kind === "faq" ? (
            <>
              <label className="field">
                <span>Categoría</span>
                <select
                  name="category_id"
                  defaultValue={faq?.category_id}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatCategoryDisplayName(item.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Título corto</span>
                <input name="title" defaultValue={faq?.title} minLength={3} />
              </label>
              <label className="field">
                <span>Pregunta</span>
                <textarea
                  name="question"
                  defaultValue={faq?.question}
                  rows={3}
                  minLength={3}
                  required
                />
              </label>
              <label className="field">
                <span>Respuesta</span>
                <textarea
                  name="answer"
                  defaultValue={faq?.answer}
                  rows={7}
                  required
                />
              </label>
              <label className="field">
                <span>Resumen</span>
                <textarea name="summary" defaultValue={faq?.summary} rows={3} />
              </label>
              <label className="field">
                <span>Palabras clave</span>
                <input
                  name="keywords"
                  defaultValue={faq?.tags.join(", ")}
                  required
                />
              </label>
              <label className="field">
                <span>Etiquetas separadas por comas</span>
                <input name="tags" defaultValue={faq?.tags.join(", ")} />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Nombre</span>
                <input
                  name="name"
                  defaultValue={
                    category ? formatCategoryDisplayName(category.name) : ""
                  }
                  onChange={() => setCategoryNameEdited(true)}
                  minLength={2}
                  required
                />
              </label>
              <label className="field">
                <span>Descripción</span>
                <textarea
                  name="description"
                  defaultValue={category?.description ?? ""}
                  rows={5}
                  required
                />
              </label>
            </>
          )}
          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="form-actions">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function SlaPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["sla", "policies"],
    queryFn: api.sla.policies,
  });
  const policies = Array.isArray(query.data)
    ? (query.data as readonly Record<string, unknown>[])
    : [];
  const [editor, setEditor] = useState<Record<string, unknown> | "new" | null>(
    null,
  );
  return (
    <div className="sla-page">
      <PageIntro
        className="sla-page__intro"
        title="Políticas SLA"
        description="Consulta y ajusta los tiempos que ordenan la atención."
        actions={
          <Button
            className="sla-page__create-button"
            onClick={() => setEditor("new")}
          >
            <Plus aria-hidden="true" /> Nueva política
          </Button>
        }
      />
      <div className="sla-explainer sla-page__explainer">
        <FileClock aria-hidden="true" />
        <div>
          <h2>Los tiempos son parte de la experiencia</h2>
          <p>
            Las pausas y reanudaciones quedan asociadas al ticket y requieren un
            motivo.
          </p>
        </div>
      </div>
      <section className="sla-page__results" aria-label="Políticas configuradas">
        {query.isLoading ? (
          <div className="sla-page__loading">
            <Skeleton rows={7} />
          </div>
        ) : policies.length ? (
          <div className="policy-list sla-page__policy-list">
            {policies.map((policy, index) => (
              <article
                className="policy-card sla-policy-card"
                key={displayValue(policy.id, String(index))}
              >
                <div className="sla-policy-card__heading">
                  <div>
                    <span className="sla-policy-card__priority">
                      {displayValue(policy.priority, "Política")}
                    </span>
                    <h2>{displayValue(policy.name, `Política ${index + 1}`)}</h2>
                  </div>
                  <span className="sla-policy-card__icon" aria-hidden="true">
                    <Clock3 />
                  </span>
                </div>
                <dl className="sla-policy-card__timings">
                  {Object.entries(policy)
                    .filter(([key]) => key.includes("seconds"))
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{getSlaPolicyTimeLabel(key)}</dt>
                        <dd>
                          {Math.round(Number(value) / 3600)} <span>h</span>
                        </dd>
                      </div>
                    ))}
                </dl>
                <Button
                  className="sla-policy-card__edit-button"
                  variant="secondary"
                  onClick={() => setEditor(policy)}
                >
                  <PencilLine aria-hidden="true" /> Editar política
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <StatePanel
            kind="empty"
            title="No hay políticas visibles"
            message="Verifica la configuración del servicio."
          />
        )}
      </section>
      {editor ? (
        <SlaEditorDialog
          policy={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["sla", "policies"],
            });
            setEditor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function getSlaPolicyTimeLabel(key: string): string {
  const labels: Readonly<Record<string, string>> = {
    first_response_seconds: "Primera respuesta",
    resolution_seconds: "Tiempo de resolución",
    warning_seconds: "Aviso previo",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

function SlaEditorDialog({
  policy,
  onClose,
  onSaved,
}: {
  readonly policy?: Readonly<Record<string, unknown>>;
  readonly onClose: () => void;
  readonly onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });
  const mutation = useMutation({
    mutationFn: (body: Readonly<Record<string, unknown>>) => {
      const id = typeof policy?.id === "string" ? policy.id : null;
      return id ? api.sla.updatePolicy(id, body) : api.sla.createPolicy(body);
    },
    onSuccess: onSaved,
    onError: (value) =>
      setError(
        value instanceof ApiError
          ? value.message
          : "No pudimos guardar la política.",
      ),
  });
  const hours = (name: string, fallback: number) => {
    const value = policy?.[name];
    return typeof value === "number" ? Math.round(value / 3600) : fallback;
  };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="editor-dialog editor-dialog--sla"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sla-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-dialog__head">
          <h2 id="sla-editor-title">
            {policy ? "Editar política" : "Nueva política"}
          </h2>
          <div className="sla-editor-dialog__tools">
            <span>Control operativo</span>
            <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const seconds = (name: string) =>
              Math.max(0, Number(textField(form, name))) * 3600;
            mutation.mutate({
              priority: textField(form, "priority") || null,
              category_id: textField(form, "category_id") || null,
              source: textField(form, "source") || null,
              first_response_seconds: seconds("first_response_hours"),
              resolution_seconds: seconds("resolution_hours"),
              warning_seconds: seconds("warning_hours"),
              timezone_name: "America/Lima",
              calendar_name: "24x7",
              is_active: form.get("is_active") === "on",
            });
          }}
        >
          <label className="field">
            <span>Prioridad</span>
            <select
              name="priority"
              defaultValue={displayValue(policy?.priority, "")}
            >
              <option value="">Todas</option>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </label>
          <label className="field">
            <span>Categoría</span>
            <select
              name="category_id"
              defaultValue={displayValue(policy?.category_id, "")}
            >
              <option value="">Todas</option>
              {categories.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Origen</span>
            <select
              name="source"
              defaultValue={displayValue(policy?.source, "")}
            >
              <option value="">Todos</option>
              <option value="MANUAL">Registro manual</option>
              <option value="CHATBOT">Asistente</option>
            </select>
          </label>
          <label className="field">
            <span>Primera respuesta (horas)</span>
            <input
              name="first_response_hours"
              type="number"
              min="1"
              defaultValue={hours("first_response_seconds", 4)}
              required
            />
          </label>
          <label className="field">
            <span>Resolución (horas)</span>
            <input
              name="resolution_hours"
              type="number"
              min="1"
              defaultValue={hours("resolution_seconds", 24)}
              required
            />
          </label>
          <label className="field">
            <span>Advertencia previa (horas)</span>
            <input
              name="warning_hours"
              type="number"
              min="0"
              defaultValue={hours("warning_seconds", 2)}
              required
            />
          </label>
          <label className="switch">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={policy?.is_active !== false}
            />{" "}
            Política activa
          </label>
          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}
          <div className="form-actions">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Guardar política
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ReportsPage() {
  const [reportName, setReportName] = useState("by-status");
  const summary = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => api.reports.summary(),
  });
  const report = useQuery({
    queryKey: ["reports", reportName],
    queryFn: () =>
      reportName === "by-status"
        ? api.reports.byStatus()
        : reportName === "by-category"
          ? api.reports.byCategory()
          : reportName === "by-priority"
            ? api.reports.byPriority()
            : api.reports.resolutionTime(),
  });
  const rows = normalizeRows(report.data);
  const exportReport = async () => {
    const result = await api.reports.export(reportName, { format: "csv" });
    const url = URL.createObjectURL(result.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportName}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageIntro
        title="Reportes"
        description="Analiza la operación con datos producidos por el backend."
        actions={
          <Button
            className="reports-export-button"
            variant="secondary"
            onClick={() => void exportReport()}
          >
            <Download aria-hidden="true" />
            Exportar CSV
          </Button>
        }
      />
      <div className="report-controls">
        <label>
          Vista
          <select
            value={reportName}
            onChange={(event) => setReportName(event.target.value)}
          >
            <option value="by-status">Por estado</option>
            <option value="by-category">Por categoría</option>
            <option value="by-priority">Por prioridad</option>
            <option value="resolution-time">Tiempo de resolución</option>
          </select>
        </label>
      </div>
      {summary.isLoading || report.isLoading ? (
        <Skeleton rows={8} />
      ) : report.isError ? (
        <PermissionAwareError
          error={report.error}
          retry={() => void report.refetch()}
        />
      ) : (
        <>
          <section className="dashboard-summary">
            {Object.entries((summary.data ?? {}) as Record<string, unknown>)
              .slice(0, 3)
              .map(([key, value]) => (
                <article key={key}>
                  <span>{key.replaceAll("_", " ")}</span>
                  <strong>{String(value)}</strong>
                  <p>Dato del periodo consultado.</p>
                </article>
              ))}
          </section>
          <div className="report-table">
            {rows.length ? (
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0] ?? {}).map((key) => (
                      <th key={key}>{reportColumnLabel(key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      {Object.entries(row).map(([key, value]) => (
                        <td key={key}>{reportCellLabel(key, value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <StatePanel
                kind="empty"
                title="No hay datos para el periodo"
                message="Cambia el rango o vuelve a intentarlo más tarde."
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

export function AuditPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["audit", search, page],
    queryFn: () => api.audit.list({ page, page_size: 20, search }),
  });
  return (
    <>
      <PageIntro
        title="Auditoría"
        description="Consulta eventos operativos con actor, resultado y correlación."
      />
      <label className="search-field">
        <Search aria-hidden="true" />
        <span className="sr-only">Buscar en auditoría</span>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Acción, recurso o identificador…"
          autoComplete="off"
        />
      </label>
      {query.isLoading ? (
        <Skeleton rows={8} />
      ) : query.isError ? (
        <PermissionAwareError
          error={query.error}
          retry={() => void query.refetch()}
        />
      ) : query.data?.items.length ? (
        <>
          <div className="audit-list">
            {query.data.items.map((item, index) => (
              <article
                key={`${item.request_id ?? "audit"}-${item.occurred_at}-${index}`}
              >
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong>{item.action}</strong>
                  <span>
                    {item.resource_type} · {item.actor_role ?? "Sistema"}
                  </span>
                </div>
                <span
                  className={`audit-result audit-result--${item.success ? "success" : "error"}`}
                >
                  {item.success ? "ÉXITO" : "ERROR"}
                </span>
                <time dateTime={item.occurred_at}>
                  {formatDate(item.occurred_at)}
                </time>
                <code>{item.request_id ?? "Sin correlativo"}</code>
              </article>
            ))}
          </div>
          <PaginationControls
            page={page}
            totalPages={query.data.total_pages ?? query.data.pages ?? 1}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      ) : (
        <StatePanel
          kind="empty"
          title="No hay eventos para mostrar"
          message="Ajusta la búsqueda o el periodo consultado."
        />
      )}
    </>
  );
}

function OperationalTable({
  tickets,
  basePath,
}: {
  readonly tickets: readonly Ticket[];
  readonly basePath: string;
}) {
  return tickets.length ? (
    <div className="operational-table">
      <div className="operational-table__head">
        <span>Código</span>
        <span>Solicitud</span>
        <span>Prioridad</span>
        <span>Estado</span>
        <span>Actualización</span>
        <span />
      </div>
      {tickets.map((ticket) => (
        <Link key={ticket.id} to={`${basePath}/${ticket.id}`}>
          <strong>{ticket.tracking_code}</strong>
          <span>
            <b>{ticket.subject}</b>
            <small>{ticket.description}</small>
          </span>
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
          <time>{formatDate(ticket.updated_at)}</time>
          <ChevronRight aria-hidden="true" />
        </Link>
      ))}
    </div>
  ) : (
    <StatePanel
      kind="empty"
      title="No hay tickets en esta vista"
      message="Cambia el filtro o actualiza la cola."
    />
  );
}

function PermissionAwareError({
  error,
  retry,
}: {
  readonly error: Error;
  readonly retry: () => void;
}) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <StatePanel
      kind={forbidden ? "forbidden" : "error"}
      title={
        forbidden
          ? "No tienes permiso para esta vista"
          : "No pudimos cargar la información"
      }
      message={
        forbidden
          ? "Tu rol no incluye esta operación."
          : "Conserva el identificador de solicitud si necesitas contactar a soporte."
      }
      actionLabel={forbidden ? undefined : "Reintentar"}
      onAction={forbidden ? undefined : retry}
    />
  );
}

function normalizeRows(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value as readonly Record<string, unknown>[];
  if (
    value &&
    typeof value === "object" &&
    "items" in value &&
    Array.isArray(value.items)
  )
    return (value as { items: readonly Record<string, unknown>[] }).items;
  if (isRecord(value)) return [value];
  return [];
}

const reportColumnLabels: Readonly<Record<string, string>> = {
  status: "Estado",
  count: "Solicitudes",
};

const reportStatusLabels: Readonly<Record<string, string>> = {
  NUEVO: "Disponible",
  ASIGNADO: "Por atender",
  EN_PROCESO: "En atención",
  PENDIENTE_CLIENTE: "Esperando al cliente",
  RESUELTO: "Resuelto por cerrar",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

function reportColumnLabel(key: string): string {
  return reportColumnLabels[key] ?? key.replaceAll("_", " ");
}

function reportCellLabel(key: string, value: unknown): string {
  if (key === "status" && typeof value === "string") {
    return reportStatusLabels[value] ?? value;
  }
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function displayValue(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
