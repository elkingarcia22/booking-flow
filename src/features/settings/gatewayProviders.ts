/**
 * Las pasarelas de pago que se pueden conectar y lo que cada una deja cobrar
 * en la reserva en línea.
 *
 * Una barbería puede tener sucursales en Estados Unidos y en Colombia: cada
 * sucursal cobra con la pasarela de su país (Configuración › Sucursales), y
 * los métodos que ve el cliente salen de esa pasarela. Lo comparten la
 * pantalla de Configuración y el backend (simulado hoy), para que las dos
 * reconozcan las mismas claves.
 *
 * Los métodos son los que ofrece la reserva, no la lista completa de cada
 * proveedor; se confirman contra la cuenta real al conectarla.
 */

export const GATEWAY_PROVIDERS = ["stripe", "square", "wompi", "bold", "mercadopago"] as const;
export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

/** Cómo paga el cliente en línea. «pse» y «nequi» son de Colombia. */
export const ONLINE_METHODS = ["card", "wallet", "pse", "nequi"] as const;
export type OnlineMethod = (typeof ONLINE_METHODS)[number];

export interface GatewayProviderSpec {
  /** El nombre comercial: no se traduce. */
  name: string;
  /** Dónde opera, en códigos ISO de país, para ordenar la lista según la sucursal. */
  countries: readonly string[];
  methods: readonly OnlineMethod[];
  /** Con qué empiezan sus claves; vacío = no tiene un prefijo fijo. */
  publicPrefixes: readonly string[];
  secretPrefixes: readonly string[];
}

/** Lo mínimo que mide una clave sin prefijo fijo. */
const MIN_KEY_LENGTH = 16;

export const GATEWAY_SPECS: Record<GatewayProvider, GatewayProviderSpec> = {
  stripe: { name: "Stripe", countries: ["US", "MX"], methods: ["card", "wallet"], publicPrefixes: ["pk_"], secretPrefixes: ["sk_"] },
  square: { name: "Square", countries: ["US"], methods: ["card", "wallet"], publicPrefixes: ["sq0idp-", "sandbox-sq0idb-"], secretPrefixes: ["EAAA"] },
  wompi: { name: "Wompi", countries: ["CO"], methods: ["card", "pse", "nequi"], publicPrefixes: ["pub_test_", "pub_prod_"], secretPrefixes: ["prv_test_", "prv_prod_"] },
  bold: { name: "Bold", countries: ["CO"], methods: ["card", "pse", "nequi"], publicPrefixes: [], secretPrefixes: [] },
  mercadopago: { name: "Mercado Pago", countries: ["CO", "MX"], methods: ["card", "pse"], publicPrefixes: ["APP_USR-", "TEST-"], secretPrefixes: ["APP_USR-", "TEST-"] },
};

export const isGatewayProvider = (value: unknown): value is GatewayProvider => GATEWAY_PROVIDERS.includes(value as GatewayProvider);

/** Si una clave tiene la forma que espera ese proveedor. */
export function keyLooksValid(provider: GatewayProvider, kind: "public" | "secret", key: string): boolean {
  const value = key.trim();
  const prefixes = kind === "public" ? GATEWAY_SPECS[provider].publicPrefixes : GATEWAY_SPECS[provider].secretPrefixes;
  if (prefixes.length === 0) return value.length >= MIN_KEY_LENGTH;
  return prefixes.some((prefix) => value.startsWith(prefix) && value.length > prefix.length);
}

/** El ejemplo de clave que se enseña en el campo: el primer prefijo del proveedor. */
export const keyPlaceholder = (provider: GatewayProvider, kind: "public" | "secret"): string => {
  const prefix = (kind === "public" ? GATEWAY_SPECS[provider].publicPrefixes : GATEWAY_SPECS[provider].secretPrefixes)[0];
  return prefix ? `${prefix}…` : "";
};
