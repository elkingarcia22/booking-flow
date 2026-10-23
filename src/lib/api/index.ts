import { createApiClient, type ApiAuthBridge } from "./client";
import { env } from "./env";

/**
 * Puente entre el cliente HTTP y la sesión. `AuthProvider` lo rellena al
 * montar; hasta entonces las peticiones salen sin token.
 */
export const apiAuth: ApiAuthBridge = {
  getToken: () => null,
  onUnauthorized: undefined,
  getStepUp: undefined,
  getViewAs: undefined,
  onStepUpRequired: undefined,
};

/** El cliente que usan todas las features. */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  auth: {
    getToken: () => apiAuth.getToken(),
    onUnauthorized: () => apiAuth.onUnauthorized?.(),
    getStepUp: () => apiAuth.getStepUp?.() ?? null,
    getViewAs: () => apiAuth.getViewAs?.() ?? null,
    onStepUpRequired: () => apiAuth.onStepUpRequired?.() ?? Promise.resolve(false),
  },
});

export { createApiClient, buildUrl, type ApiClient, type RequestOptions, type QueryParams } from "./client";
export { ApiError, isApiError, describeError, codeFromStatus, type ApiErrorCode } from "./errors";
export { env } from "./env";
