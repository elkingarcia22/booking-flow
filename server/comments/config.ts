/** Lo que la función de comentarios lee del entorno. Nada de esto llega al navegador. */
export interface CommentsServerConfig {
  /** JSON de la cuenta de servicio de Google (o ese JSON en base64): la misma del feedback. */
  googleServiceAccount: string | undefined;
  /** Correos que reciben acceso de edición a la hoja al crearla. */
  shareWith: readonly string[];
  /** Abrir la hoja a cualquiera que tenga el enlace: solo lectura o también edición. Sin esto, solo `shareWith`. */
  linkAccess: "reader" | "writer" | undefined;
  /** Si ya existe una hoja (compartida con la cuenta de servicio), su id; sin él se crea una sola. */
  sheetId: string | undefined;
}

export function readCommentsConfig(env: Record<string, string | undefined> = process.env): CommentsServerConfig {
  return {
    googleServiceAccount: env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || undefined,
    shareWith: (env.FEEDBACK_SHARE_WITH ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    linkAccess: ["reader", "writer"].includes(env.COMMENTS_SHEET_LINK_ACCESS?.trim() ?? "") ? (env.COMMENTS_SHEET_LINK_ACCESS!.trim() as "reader" | "writer") : undefined,
    sheetId: env.COMMENTS_SHEET_ID?.trim() || undefined,
  };
}
