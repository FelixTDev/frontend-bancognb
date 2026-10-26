export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?:
    | readonly {
        readonly loc: readonly (string | number)[];
        readonly msg: string;
        readonly type: string;
      }[]
    | Readonly<Record<string, unknown>>
    | null;
  readonly request_id?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorPayload["details"];
  readonly requestId: string | null;

  constructor(input: {
    status: number;
    payload: ApiErrorPayload;
    requestId: string | null;
  }) {
    super(input.payload.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.payload.code;
    this.details = input.payload.details;
    this.requestId = input.payload.request_id ?? input.requestId;
  }
}

export interface HttpResult<T> {
  readonly data: T;
  readonly requestId: string | null;
  readonly headers: Headers;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  readonly body?: unknown;
  readonly isFormData?: boolean;
}

interface ClientOptions {
  readonly baseUrl: string;
  readonly getToken: () => string | null;
  readonly onUnauthorized?: () => void;
}

const fallbackMessage = (status: number): string =>
  ({
    401: "Tu sesión terminó. Inicia sesión nuevamente.",
    403: "No tienes permisos para realizar esta acción.",
    404: "No encontramos el recurso solicitado.",
    409: "La información cambió. Actualiza la pantalla e inténtalo nuevamente.",
    413: "El archivo supera el tamaño permitido.",
    415: "El tipo de archivo no está permitido.",
    422: "Revisa los datos enviados.",
    429: "Se alcanzó el límite de solicitudes. Espera un momento.",
    500: "No pudimos completar la operación.",
    503: "El servicio no está disponible temporalmente.",
  })[status] ?? "La solicitud no pudo completarse.";

const defaultCode = (status: number): string => `HTTP_${status}`;

export function createHttpClient(options: ClientOptions) {
  async function request<T>(
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<HttpResult<T>> {
    const token = options.getToken();
    const headers = new Headers(requestOptions.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Request-ID", crypto.randomUUID());
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (requestOptions.body !== undefined && !requestOptions.isFormData)
      headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await fetch(`${options.baseUrl}${path}`, {
        ...requestOptions,
        headers,
        body:
          requestOptions.body === undefined
            ? undefined
            : requestOptions.isFormData
              ? (requestOptions.body as BodyInit)
              : JSON.stringify(requestOptions.body),
      });
    } catch {
      throw new ApiError({
        status: 0,
        payload: {
          code: "NETWORK_ERROR",
          message:
            "No pudimos conectarnos con el servicio. Verifica tu conexión e inténtalo nuevamente.",
        },
        requestId: null,
      });
    }

    const requestId = response.headers.get("X-Request-ID");
    if (!response.ok) {
      const raw = (await response
        .json()
        .catch(() => null)) as Partial<ApiErrorPayload> | null;
      const payload: ApiErrorPayload = {
        code: raw?.code ?? defaultCode(response.status),
        message: raw?.message ?? fallbackMessage(response.status),
        details: raw?.details ?? null,
        request_id: raw?.request_id,
      };
      if (response.status === 401) options.onUnauthorized?.();
      throw new ApiError({ status: response.status, payload, requestId });
    }

    if (response.status === 204)
      return { data: undefined as T, requestId, headers: response.headers };
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? ((await response.json()) as T)
      : ((await response.blob()) as T);
    return { data, requestId, headers: response.headers };
  }
  return { request };
}
