export const safeUnverifiedFaqAnswer =
  "No tengo información verificada para responder esta consulta financiera.";

export interface FaqContentInput {
  readonly question: string;
  readonly answer: string;
  readonly source_url?: string | null;
  readonly source_verified_at?: string | null;
}

export interface SafeFaqContent {
  readonly question: string;
  readonly answer: string;
  readonly isGenericFallback: boolean;
}

export function containsRemovedInstitutionReference(value: string): boolean {
  return /\bGNB\b|bancognb\.com\.pe/iu.test(value);
}

function normalizeFaqQuestion(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("es-PE");
}

const legacyQuestionTitles = new Map<string, string>([
  [
    normalizeFaqQuestion("¿Qué tipos de cuentas ofrece Banco GNB?"),
    "¿Qué tipos de cuentas ofrece una entidad financiera?",
  ],
  [
    normalizeFaqQuestion("¿Cómo presento un reclamo formal a Banco GNB?"),
    "¿Cómo presento un reclamo formal ante una entidad financiera?",
  ],
  [
    normalizeFaqQuestion("¿Qué requisitos necesito para una tarjeta?"),
    "¿Qué requisitos necesito para solicitar una tarjeta?",
  ],
]);

const cleanupTrackedQuestions = new Set(
  [
    "¿Qué requisitos necesito para solicitar una tarjeta?",
    "¿Cómo ingreso a la banca digital?",
    "¿Cómo consulto el saldo de mi cuenta?",
    "¿Qué hago si mi tarjeta está bloqueada?",
    "¿Cómo solicito información sobre un crédito?",
    "¿Cómo consulto el estado de un reclamo?",
    "¿Cómo solicito un estado de cuenta?",
    "¿Cómo puedo contactar a un asesor?",
    "¿Puedo habilitar o deshabilitar compras por internet en mi tarjeta?",
    "¿Cómo me afilio a Banca Móvil?",
    "¿Qué hago si olvidé mi contraseña de Banca Móvil?",
    "¿Qué necesito para abrir una Cuenta de Ahorro?",
    "¿Qué tipos de cuentas ofrece una entidad financiera?",
    "¿El asistente puede decirme si me aprobarán un préstamo?",
    "¿Cuál es la diferencia entre un reclamo y un requerimiento?",
    "¿Cómo presento un reclamo formal ante una entidad financiera?",
    "¿Cuánto tarda la respuesta de un reclamo formal?",
    "¿Cuál es el horario de Banca por Teléfono?",
    "¿Qué hago si no reconozco una operación con mi tarjeta?",
  ].map(normalizeFaqQuestion),
);

export function getSafeFaqContent(faq: FaqContentInput): SafeFaqContent {
  const normalizedQuestion = normalizeFaqQuestion(faq.question);
  const legacyQuestion = legacyQuestionTitles.get(normalizedQuestion);
  const questionHasInstitution = containsRemovedInstitutionReference(
    faq.question,
  );
  const staleSourceMetadata = Boolean(faq.source_url || faq.source_verified_at);
  const isGenericFallback = Boolean(
    legacyQuestion ||
      questionHasInstitution ||
      containsRemovedInstitutionReference(faq.answer) ||
      containsRemovedInstitutionReference(faq.source_url ?? "") ||
      (cleanupTrackedQuestions.has(normalizedQuestion) && staleSourceMetadata),
  );

  return {
    question:
      legacyQuestion ??
      (questionHasInstitution
        ? "Consulta sobre productos y servicios financieros"
        : faq.question),
    answer: isGenericFallback ? safeUnverifiedFaqAnswer : faq.answer,
    isGenericFallback,
  };
}
