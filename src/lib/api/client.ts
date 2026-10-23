import type { ZodType } from "zod";
import { ApiError, codeFromStatus } from "./errors";

/**
 * Cliente HTTP mínimo y tipado sobre `fetch`. Sabe tres cosas: dónde está la
 * API, cómo adjuntar el token y cómo convertir cualquier fallo en `ApiError`.
 * Todo lo demás (caché, reintentos, estados) es de TanStack Query.
 */

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions<T> {
  query?: QueryParams;
  /** Valida la respuesta; si no cuadra, lanza `ApiError` con code `invalid_response`. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Milisegundos antes de abortar. Por defecto 15 s. */
  timeoutMs?: number;
  /** Interno: ya se pidió confirmar la identidad para esta petición. */
  retriedStepUp?: boolean;
}

export interface ApiAuthBridge {
  getToken: () => string | null;
  /** Se llama ante un 401: la sesión debe cerrarse desde fuera. */
  onUnauthorized?: () => void;
  /** La confirmación de identidad vigente (`X-Step-Up`), si hay. */
  getStepUp?: () => string | null;
  /** El rol con el que se está mirando («Ver como», `X-View-As`): el servidor no deja cambiar nada así. */
  getViewAs?: () => string | null;
  /**
   * El servidor pidió confirmar la identidad: quien escucha pide el código y resuelve `true` cuando
   * hay una confirmación nueva (se repite la petición una vez) o `false` si la persona desistió.
   */
  onStepUpRequired?: () => Promise<boolean>;
}

export interface ApiClientOptions {
  baseUrl: string;
  auth?: ApiAuthBridge;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = path.startsWith("http") ? path : `${baseUrl}/${path.replace(/^\/+/, "")}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const code = codeFromStatus(status);
  if (body && typeof body === "object") {
    const record = body as { message?: unknown; code?: unknown; details?: unknown; fields?: unknown };
    return new ApiError({
      status,
      code: typeof record.code === "string" && record.code in CODE_ALIASES ? CODE_ALIASES[record.code] : code,
      message: typeof record.message === "string" ? record.message : `HTTP ${status}`,
      details: record.details ?? (record.fields ? { fields: record.fields } : undefined),
    });
  }
  return new ApiError({ status, code, message: typeof body === "string" && body ? body : `HTTP ${status}` });
}

/** Códigos que un backend puede mandar y que mapeamos a los nuestros. */
const CODE_ALIASES: Record<string, ApiError["code"]> = {
  step_up_required: "step_up_required",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  not_found: "not_found",
  conflict: "conflict",
  validation_error: "validation",
  validation: "validation",
  rate_limited: "rate_limited",
};

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions<T>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions<T>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions<T>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions<T>): Promise<T>;
  delete<T>(path: string, options?: RequestOptions<T>): Promise<T>;
}

export function createApiClient({ baseUrl, auth, fetchImpl }: ApiClientOptions): ApiClient {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T>(method: string, path: string, body: unknown, options: RequestOptions<T> = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    options.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = auth?.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const stepUp = auth?.getStepUp?.();
    if (stepUp) headers["X-Step-Up"] = stepUp;
    const viewAs = auth?.getViewAs?.();
    if (viewAs) headers["X-View-As"] = viewAs;

    let response: Response;
    try {
      response = await doFetch(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: "same-origin",
      });
    } catch (error) {
      window.clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError({ status: 0, code: "timeout", message: "La solicitud tardó demasiado." });
      }
      throw new ApiError({ status: 0, code: "network", message: "No se pudo conectar con el servidor." });
    }
    window.clearTimeout(timeout);

    const parsed = await parseBody(response);
    if (!response.ok) {
      const apiError = toApiError(response.status, parsed);
      if (apiError.code === "unauthorized") auth?.onUnauthorized?.();
      // Lo sensible: se confirma la identidad y se repite una sola vez.
      if (apiError.code === "step_up_required" && !options.retriedStepUp && auth?.onStepUpRequired && (await auth.onStepUpRequired())) {
        return request(method, path, body, { ...options, retriedStepUp: true });
      }
      throw apiError;
    }
    if (options.schema) {
      const result = options.schema.safeParse(parsed);
      if (!result.success) {
        throw new ApiError({
          status: response.status,
          code: "invalid_response",
          message: "La respuesta del servidor no tiene la forma esperada.",
          details: result.error.issues,
        });
      }
      return result.data;
    }
    return parsed as T;
  }

  return {
    get: (path, options) => request("GET", path, undefined, options),
    post: (path, body, options) => request("POST", path, body, options),
    put: (path, body, options) => request("PUT", path, body, options),
    patch: (path, body, options) => request("PATCH", path, body, options),
    delete: (path, options) => request("DELETE", path, undefined, options),
  };
}
