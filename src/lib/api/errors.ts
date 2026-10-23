/**
 * Un único tipo de error para todo lo que sale de la API. La UI nunca mira
 * un `Response` ni un `fetch` fallido: recibe un `ApiError` con un `code`
 * estable y un mensaje ya pensado para mostrarse.
 */
export type ApiErrorCode =
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  /** Lo sensible pide confirmar la identidad con un código nuevo (`X-Step-Up`). */
  | "step_up_required"
  | "server"
  | "invalid_response"
  | "unknown";

export interface ApiErrorShape {
  status: number;
  code: ApiErrorCode;
  message: string;
  /** Errores por campo (`{ email: ["Ya existe"] }`) u otro detalle del servidor. */
  details?: unknown;
}

export class ApiError extends Error implements ApiErrorShape {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor({ status, code, message, details }: ApiErrorShape) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Errores por campo si el servidor los envió con la forma `{ fields: { campo: [msg] } }`. */
  get fieldErrors(): Record<string, string[]> | undefined {
    if (this.details && typeof this.details === "object" && "fields" in this.details) {
      const fields = (this.details as { fields?: unknown }).fields;
      if (fields && typeof fields === "object") return fields as Record<string, string[]>;
    }
    return undefined;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function codeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}

const MESSAGES: Record<ApiErrorCode, { title: string; description: string }> = {
  network: { title: "Sin conexión", description: "No pudimos llegar al servidor. Revisa tu red e inténtalo de nuevo." },
  timeout: { title: "Tardó demasiado", description: "El servidor no respondió a tiempo. Inténtalo de nuevo." },
  unauthorized: { title: "Sesión expirada", description: "Vuelve a iniciar sesión para continuar." },
  forbidden: { title: "Sin permiso", description: "Tu cuenta no puede realizar esta acción." },
  not_found: { title: "No encontrado", description: "Lo que buscas ya no existe o fue movido." },
  conflict: { title: "Conflicto", description: "Alguien más cambió este dato. Recarga y vuelve a intentarlo." },
  validation: { title: "Datos inválidos", description: "Revisa los campos marcados." },
  rate_limited: { title: "Demasiadas solicitudes", description: "Espera unos segundos antes de volver a intentarlo." },
  step_up_required: { title: "Confirma que eres tú", description: "Para esto hace falta el código que te enviamos al celular." },
  server: { title: "Error del servidor", description: "Algo falló de nuestro lado. Ya estamos avisados." },
  invalid_response: { title: "Respuesta inesperada", description: "El servidor devolvió datos con una forma que no reconocemos." },
  unknown: { title: "Algo salió mal", description: "Inténtalo de nuevo; si persiste, contáctanos." },
};

/** Título y descripción listos para un `ErrorState`, un toast o un `Alert`. */
export function describeError(error: unknown): { title: string; description: string; code: ApiErrorCode } {
  if (isApiError(error)) {
    const base = MESSAGES[error.code];
    // El mensaje del servidor gana cuando es humano (no un stack ni un JSON).
    const serverMessage = error.message && error.message.length < 200 && !error.message.startsWith("{") ? error.message : undefined;
    return { ...base, description: serverMessage ?? base.description, code: error.code };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { ...MESSAGES.timeout, code: "timeout" };
  }
  return { ...MESSAGES.unknown, code: "unknown" };
}
