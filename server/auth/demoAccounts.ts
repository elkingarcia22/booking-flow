/**
 * Las cuentas de la demo, del lado del servidor: con ellas `api/session` firma la sesión mientras no
 * haya backend real (que emitirá el token al entrar, con el mismo `SESSION_SECRET`). Deben coincidir
 * con `ACCOUNTS` de `src/mocks/db.ts`; una prueba lo vigila.
 */

export interface DemoAccount {
  phone: string;
  sub: string;
  role: "owner" | "admin" | "recepcion" | "barbero-comision" | "barbero-renta";
  mid: string;
}

/** La barbería de la demo: todo lo que se encola queda dentro de ella. */
export const DEMO_TENANT = "demo";
/** El código de la demo (el mismo que acepta el backend simulado). Se cambia con `DEMO_OTP_CODE`. */
export const DEMO_OTP_CODE = "246810";

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { phone: "+573001234567", sub: "usr_0001", role: "owner", mid: "team-01" },
  { phone: "+573007654321", sub: "usr_0002", role: "admin", mid: "team-02" },
  { phone: "+573005550103", sub: "usr_0003", role: "recepcion", mid: "team-03" },
  { phone: "+573005550104", sub: "usr_0004", role: "barbero-comision", mid: "team-04" },
  { phone: "+573005550130", sub: "usr_0030", role: "barbero-renta", mid: "team-30" },
];

/** Un celular con o sin «+», espacios o guiones → E.164. */
export const normalizePhone = (value: unknown): string => (typeof value === "string" ? `+${value.replace(/\D/g, "")}` : "");
