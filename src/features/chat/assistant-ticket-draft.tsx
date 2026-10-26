import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Button, ButtonLink } from "../../shared/components/ui";
import type {
  ChatbotConvertedTicketSummary,
  ChatbotTicketDraft,
} from "../../shared/api/endpoints";
import type { Category } from "../../shared/types/domain";
import { formatCategoryDisplayName, ticketPriorityLabels } from "../../shared/ticket-labels";
import { ticketSchema, type TicketValues } from "../auth/validation";
import {
  getTicketDraftFieldLabel,
  getTicketDraftPayload,
  type ReadyTicketDraftPayload,
} from "./assistant-conversation.model";

interface AssistantTicketDraftProps {
  readonly conversationStatus: string | undefined;
  readonly draft: ChatbotTicketDraft | undefined;
  readonly convertedTicket: ChatbotConvertedTicketSummary | null | undefined;
  readonly categories: readonly Category[] | undefined;
  readonly categoriesLoading: boolean;
  readonly categoriesError: boolean;
  readonly authenticated: boolean;
  readonly chatPending: boolean;
  readonly conversionPending: boolean;
  readonly conversionRetryAvailable: boolean;
  readonly conversionConflict: boolean;
  readonly onRequireAuth: () => void;
  readonly onSelectCategory: (id: string, categoryName: string) => void;
  readonly onCorrect: (
    body: ReadyTicketDraftPayload,
    categoryName: string,
  ) => void;
  readonly onCancel: () => void;
  readonly onConfirm: (body: ReadyTicketDraftPayload) => void;
  readonly onRetry: () => void;
}

function categoryOptionsFor(
  draft: ChatbotTicketDraft,
  categories: readonly Category[] | undefined,
) {
  const options = new Map<string, string>();
  for (const option of draft.category_options ?? []) {
    options.set(option.id, option.name);
  }
  for (const category of categories ?? []) {
    if (category.is_active) options.set(category.id, category.name);
  }
  return [...options].map(([id, name]) => ({ id, name }));
}

function categoryNameFor(
  categoryId: string,
  options: readonly { readonly id: string; readonly name: string }[],
): string {
  const name = options.find((option) => option.id === categoryId)?.name;
  return name ? formatCategoryDisplayName(name) : "Categoría seleccionada";
}

function TicketDraftEditor({
  draft,
  initialValues,
  categories,
  categoriesLoading,
  categoriesError,
  onSave,
  onCancel,
}: {
  readonly draft: ChatbotTicketDraft;
  readonly initialValues: ReadyTicketDraftPayload;
  readonly categories: readonly Category[] | undefined;
  readonly categoriesLoading: boolean;
  readonly categoriesError: boolean;
  readonly onSave: (
    body: ReadyTicketDraftPayload,
    categoryName: string,
  ) => void;
  readonly onCancel: () => void;
}) {
  const form = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: initialValues,
  });
  const options = categoryOptionsFor(draft, categories);

  return (
    <form
      className="assistant-ticket-draft__editor"
      aria-label="Editar borrador del ticket"
      onSubmit={(event) => {
        void form.handleSubmit((values) =>
          onSave(values, categoryNameFor(values.category_id, options)),
        )(event);
      }}
    >
      <label>
        <span>Categoría</span>
        <select
          autoFocus
          disabled={categoriesLoading || categoriesError || options.length === 0}
          aria-invalid={Boolean(form.formState.errors.category_id)}
          aria-describedby={
            form.formState.errors.category_id
              ? "assistant-draft-category-error"
              : undefined
          }
          {...form.register("category_id")}
        >
          <option value="">Selecciona una categoría</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {formatCategoryDisplayName(option.name)}
            </option>
          ))}
        </select>
        {form.formState.errors.category_id ? (
          <small id="assistant-draft-category-error" role="alert">
            {form.formState.errors.category_id.message}
          </small>
        ) : null}
        {categoriesError ? (
          <small role="alert">
            No pudimos cargar las categorías. Inténtalo nuevamente.
          </small>
        ) : null}
      </label>
      <label>
        <span>Asunto</span>
        <input
          autoComplete="off"
          maxLength={200}
          aria-invalid={Boolean(form.formState.errors.subject)}
          aria-describedby={
            form.formState.errors.subject
              ? "assistant-draft-subject-error"
              : undefined
          }
          {...form.register("subject")}
        />
        {form.formState.errors.subject ? (
          <small id="assistant-draft-subject-error" role="alert">
            {form.formState.errors.subject.message}
          </small>
        ) : null}
      </label>
      <label>
        <span>Descripción</span>
        <textarea
          rows={4}
          maxLength={10_000}
          autoComplete="off"
          aria-invalid={Boolean(form.formState.errors.description)}
          aria-describedby={
            form.formState.errors.description
              ? "assistant-draft-description-error"
              : undefined
          }
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <small id="assistant-draft-description-error" role="alert">
            {form.formState.errors.description.message}
          </small>
        ) : null}
      </label>
      <label>
        <span>Prioridad</span>
        <select
          aria-invalid={Boolean(form.formState.errors.priority)}
          {...form.register("priority")}
        >
          {Object.entries(ticketPriorityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {form.formState.errors.priority ? (
          <small role="alert">Selecciona una prioridad válida.</small>
        ) : null}
      </label>
      <div className="assistant-ticket-draft__actions">
        <Button type="button" variant="quiet" onClick={onCancel}>
          Volver al resumen
        </Button>
        <Button type="submit" disabled={categoriesLoading || categoriesError}>
          Guardar correcciones
        </Button>
      </div>
    </form>
  );
}

export function AssistantTicketDraft({
  conversationStatus,
  draft,
  convertedTicket,
  categories,
  categoriesLoading,
  categoriesError,
  authenticated,
  chatPending,
  conversionPending,
  conversionRetryAvailable,
  conversionConflict,
  onRequireAuth,
  onSelectCategory,
  onCorrect,
  onCancel,
  onConfirm,
  onRetry,
}: AssistantTicketDraftProps) {
  if (convertedTicket) {
    return (
      <section
        className={`assistant-ticket-draft${conversionConflict ? " assistant-ticket-draft--conflict" : " assistant-ticket-draft--success"}`}
        aria-labelledby="assistant-converted-ticket-title"
      >
        {conversionConflict ? (
          <>
            <h3 id="assistant-converted-ticket-title">
              La conversación ya tiene otro ticket
            </h3>
            <p role="alert">
              El contenido enviado no coincide con la solicitud existente. No
              enviamos otra conversión.
            </p>
          </>
        ) : (
          <>
            <span className="assistant-ticket-draft__eyebrow">
              Solicitud confirmada
            </span>
            <h3 id="assistant-converted-ticket-title">
              Tu solicitud quedó registrada
            </h3>
            <p role="status">
              El servidor confirmó el ticket asociado a esta conversación.
            </p>
          </>
        )}
        <dl className="assistant-ticket-draft__fields">
          <div>
            <dt>Código de seguimiento</dt>
            <dd>{convertedTicket.tracking_code}</dd>
          </div>
          <div>
            <dt>Asunto</dt>
            <dd>{convertedTicket.subject}</dd>
          </div>
        </dl>
        <ButtonLink
          to={`/app/solicitudes/${convertedTicket.id}`}
          variant="secondary"
        >
          Ver detalle de la solicitud
        </ButtonLink>
      </section>
    );
  }

  if (conversationStatus === "CONVERTED_TO_TICKET") {
    return (
      <section
        className="assistant-ticket-draft assistant-ticket-draft--conflict"
        role="alert"
      >
        <h3>Esta conversación ya fue convertida</h3>
        <p>No volveremos a enviar la conversión desde esta conversación.</p>
      </section>
    );
  }

  if (!draft || draft.status === "INACTIVE") return null;

  if (draft.status === "CANCELLED") {
    return (
      <section
        className="assistant-ticket-draft assistant-ticket-draft--cancelled"
        aria-live="polite"
      >
        <span className="assistant-ticket-draft__eyebrow">
          Borrador cancelado
        </span>
        <h3>La creación del ticket se canceló</h3>
        <p>
          La conversación sigue disponible si necesitas continuar con otra
          consulta.
        </p>
      </section>
    );
  }

  const payload = getTicketDraftPayload(draft);
  const fields = draft.fields;
  const readyStatus = draft.status === "READY_FOR_CONFIRMATION";
  const isReady = readyStatus && payload !== null;
  const options = categoryOptionsFor(draft, categories);
  const category = fields?.category_id
    ? categoryNameFor(fields.category_id, options)
    : null;

  return (
    <section
      className="assistant-ticket-draft"
      aria-labelledby="assistant-ticket-draft-title"
      aria-busy={chatPending || conversionPending}
    >
      <div className="assistant-ticket-draft__heading">
        <span className="assistant-ticket-draft__eyebrow">
          {readyStatus ? "Revisión" : "Recopilación"}
        </span>
        <h3 id="assistant-ticket-draft-title">
          {isReady
            ? "Revisa tu solicitud"
            : readyStatus
              ? "Corrige los datos del borrador"
              : "Estamos preparando tu solicitud"}
        </h3>
        <p>
          {isReady
            ? "Comprueba los datos. El ticket solo se enviará cuando confirmes."
            : readyStatus
              ? "Corrige los campos señalados antes de confirmar la creación."
              : "El asistente conservará los datos reunidos y te preguntará por lo que falte."}
        </p>
      </div>

      {fields ? (
        <dl className="assistant-ticket-draft__fields">
          {fields.category_id !== undefined ? (
            <div>
              <dt>Categoría</dt>
              <dd>{category ?? "Por definir"}</dd>
            </div>
          ) : null}
          {fields.subject !== undefined ? (
            <div>
              <dt>Asunto</dt>
              <dd>{fields.subject || "Por definir"}</dd>
            </div>
          ) : null}
          {fields.description !== undefined ? (
            <div>
              <dt>Descripción</dt>
              <dd>{fields.description || "Por definir"}</dd>
            </div>
          ) : null}
          {fields.priority !== undefined ? (
            <div>
              <dt>Prioridad</dt>
              <dd>
                {fields.priority
                  ? ticketPriorityLabels[fields.priority]
                  : "Por definir"}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {draft.missing_fields?.length ? (
        <div className="assistant-ticket-draft__missing" role="status">
          <strong>Falta completar:</strong>
          <ul>
            {draft.missing_fields.map((field) => (
              <li key={field}>{getTicketDraftFieldLabel(field)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {draft.validation_errors?.length ? (
        <ul className="assistant-ticket-draft__validation" role="alert">
          {draft.validation_errors.map((error, index) => (
            <li key={`${error.field}-${index}`}>
              <strong>{getTicketDraftFieldLabel(error.field)}:</strong>{" "}
              {error.message}
            </li>
          ))}
        </ul>
      ) : null}

      {draft.status === "COLLECTING" && draft.category_options?.length ? (
        <div className="assistant-ticket-draft__category-options">
          <strong>Elige una categoría:</strong>
          {draft.category_options.map((option) => (
            <button
              type="button"
              key={option.id}
              disabled={chatPending || conversionPending}
              onClick={() => onSelectCategory(option.id, option.name)}
            >
              {formatCategoryDisplayName(option.name)}
            </button>
          ))}
        </div>
      ) : null}

      {isReady && payload ? (
        <ReadyDraftActions
          key={`${payload.category_id}-${payload.subject}-${payload.description}-${payload.priority}`}
          draft={draft}
          payload={payload}
          categories={categories}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          authenticated={authenticated}
          chatPending={chatPending}
          conversionPending={conversionPending}
          conversionRetryAvailable={conversionRetryAvailable}
          conversionConflict={conversionConflict}
          onRequireAuth={onRequireAuth}
          onCorrect={onCorrect}
          onCancel={onCancel}
          onConfirm={onConfirm}
          onRetry={onRetry}
        />
      ) : (
        <div className="assistant-ticket-draft__actions">
          <Button
            type="button"
            variant="quiet"
            disabled={chatPending || conversionPending}
            onClick={onCancel}
          >
            Cancelar borrador
          </Button>
        </div>
      )}

      {conversionConflict ? (
        <p className="assistant-ticket-draft__inline-error" role="alert">
          La conversión entró en conflicto. Revisa el estado de la conversación
          antes de continuar.
        </p>
      ) : null}
    </section>
  );
}

function ReadyDraftActions({
  draft,
  payload,
  categories,
  categoriesLoading,
  categoriesError,
  authenticated,
  chatPending,
  conversionPending,
  conversionRetryAvailable,
  conversionConflict,
  onRequireAuth,
  onCorrect,
  onCancel,
  onConfirm,
  onRetry,
}: {
  readonly draft: ChatbotTicketDraft;
  readonly payload: ReadyTicketDraftPayload;
  readonly categories: readonly Category[] | undefined;
  readonly categoriesLoading: boolean;
  readonly categoriesError: boolean;
  readonly authenticated: boolean;
  readonly chatPending: boolean;
  readonly conversionPending: boolean;
  readonly conversionRetryAvailable: boolean;
  readonly conversionConflict: boolean;
  readonly onRequireAuth: () => void;
  readonly onCorrect: (
    body: ReadyTicketDraftPayload,
    categoryName: string,
  ) => void;
  readonly onCancel: () => void;
  readonly onConfirm: (body: ReadyTicketDraftPayload) => void;
  readonly onRetry: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TicketDraftEditor
        draft={draft}
        initialValues={payload}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onSave={(body, categoryName) => {
          if (
            body.category_id === payload.category_id &&
            body.subject === payload.subject &&
            body.description === payload.description &&
            body.priority === payload.priority
          ) {
            setEditing(false);
            return;
          }
          onCorrect(body, categoryName);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      {authenticated ? (
        <div className="assistant-ticket-draft__actions">
          <Button
            type="button"
            variant="secondary"
            disabled={chatPending || conversionPending || conversionConflict}
            onClick={() => setEditing(true)}
          >
            Editar datos
          </Button>
          <Button
            type="button"
            variant="quiet"
            disabled={chatPending || conversionPending || conversionConflict}
            onClick={onCancel}
          >
            Cancelar borrador
          </Button>
          <Button
            type="button"
            disabled={chatPending || conversionPending || conversionConflict}
            isLoading={conversionPending}
            onClick={() => onConfirm(payload)}
          >
            Confirmar creación del ticket
          </Button>
        </div>
      ) : (
        <section
          className="assistant-ticket-draft__auth"
          aria-label="Autenticación requerida"
        >
          <strong>Inicia sesión para confirmar el ticket</strong>
          <p>Tu conversación se conservará y se retomará al volver.</p>
          <div>
            <Link
              to="/ingresar?returnTo=%2Fapp%2Fasistente"
              onClick={onRequireAuth}
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro?returnTo=%2Fapp%2Fasistente"
              onClick={onRequireAuth}
            >
              Registrarme
            </Link>
          </div>
        </section>
      )}
      {conversionRetryAvailable ? (
        <div className="assistant-ticket-draft__retry">
          <p>La respuesta no llegó. Puedes reintentar con el mismo borrador.</p>
          <Button
            type="button"
            variant="secondary"
            disabled={conversionPending}
            isLoading={conversionPending}
            onClick={onRetry}
          >
            Reintentar confirmación
          </Button>
        </div>
      ) : null}
    </>
  );
}
