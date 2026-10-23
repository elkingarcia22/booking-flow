import { consentCountryOf } from "@/features/legal/consent";
import { holidaysOf, type Holiday } from "@/features/legal/sendWindow";
import { GATEWAY_PROVIDERS, GATEWAY_SPECS, type GatewayProvider } from "./gatewayProviders";

/**
 * El paquete de cada país (docs/API_CONTRACT.md, «Configuración › Paquete por país»): lo que una barbería de
 * Colombia, México o Estados Unidos necesita de serie para no arrancar con lo de otro país. Moneda, zonas,
 * festivos (con la Ley Emiliani en Colombia), identificación fiscal y cómo se valida, el impuesto habitual y
 * las pasarelas que operan allí. Lo usan la sucursal en Configuración, el registro y el backend simulado.
 *
 * Son valores por defecto: cada barbería los cambia. El impuesto en particular depende del régimen de cada una
 * (en Colombia, quien no es responsable de IVA no lo cobra), por eso se propone y no se impone.
 */

export const PACK_COUNTRIES = ["CO", "MX", "US"] as const;
export type PackCountry = (typeof PACK_COUNTRIES)[number];

export type TaxIdKind = "nit" | "rfc" | "ein";

export interface CountryPack {
  country: PackCountry;
  currency: string;
  /** La primera es la más poblada: la que se pone si no se elige otra. */
  timezones: readonly string[];
  language: "es" | "en";
  taxIdKind: TaxIdKind;
  /** Un ejemplo con el formato que se espera. */
  taxIdExample: string;
  /** El impuesto habitual sobre servicios, o `null` si depende del estado (EE. UU.). */
  taxGroup: { name: string; taxes: readonly { name: string; percent: number }[] } | null;
  weekStart: "monday" | "sunday";
  timeFormat: "12h" | "24h";
}

export const COUNTRY_PACKS: Readonly<Record<PackCountry, CountryPack>> = {
  CO: {
    country: "CO",
    currency: "COP",
    timezones: ["America/Bogota"],
    language: "es",
    taxIdKind: "nit",
    taxIdExample: "900123456-8",
    taxGroup: { name: "IVA 19 %", taxes: [{ name: "IVA", percent: 19 }] },
    weekStart: "monday",
    timeFormat: "12h",
  },
  MX: {
    country: "MX",
    currency: "MXN",
    timezones: ["America/Mexico_City", "America/Monterrey", "America/Cancun", "America/Chihuahua", "America/Hermosillo", "America/Mazatlan", "America/Tijuana"],
    language: "es",
    taxIdKind: "rfc",
    taxIdExample: "BDE240115AB1",
    taxGroup: { name: "IVA 16 %", taxes: [{ name: "IVA", percent: 16 }] },
    weekStart: "monday",
    timeFormat: "12h",
  },
  US: {
    country: "US",
    currency: "USD",
    timezones: ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"],
    language: "es",
    taxIdKind: "ein",
    taxIdExample: "12-3456789",
    taxGroup: null,
    weekStart: "sunday",
    timeFormat: "12h",
  },
};

/** El país de una sucursal (código o nombre, como venga) a su paquete; `null` si no es uno de los tres. */
export function packCountryOf(country: string | null | undefined): PackCountry | null {
  const code = consentCountryOf(country);
  return code === "GENERIC" ? null : code;
}

export const packOf = (country: string | null | undefined): CountryPack | null => {
  const code = packCountryOf(country);
  return code ? COUNTRY_PACKS[code] : null;
};

/** Si una pasarela opera en ese país. */
export const GATEWAY_COUNTRY_OK = (provider: GatewayProvider, country: PackCountry): boolean => GATEWAY_SPECS[provider].countries.includes(country);

/** Las pasarelas que operan en ese país, en el orden de la lista. */
export const gatewaysFor = (country: PackCountry): readonly GatewayProvider[] => GATEWAY_PROVIDERS.filter((provider) => GATEWAY_SPECS[provider].countries.includes(country));

/** Todas las zonas de los tres países, sin repetir: la lista de Configuración. */
export const PACK_TIMEZONES: readonly string[] = [...new Set(PACK_COUNTRIES.flatMap((country) => COUNTRY_PACKS[country].timezones))];

/** Las zonas que se ofrecen para un país (las suyas) o, sin país, todas; la actual va siempre, aunque sea de otro. */
export function timezonesFor(country: string | null | undefined, current?: string): readonly string[] {
  const own = packOf(country)?.timezones ?? PACK_TIMEZONES;
  return current && !own.includes(current) ? [current, ...own] : own;
}

// ── Festivos ─────────────────────────────────────────────────────────────────────────────────────

/** Los festivos que se cierran por defecto: los que en cada país casi todos cierran. */
export const DEFAULT_CLOSED_HOLIDAYS: Readonly<Record<PackCountry, readonly string[]>> = {
  CO: ["new-year", "holy-thursday", "good-friday", "labor", "independence", "christmas"],
  MX: ["new-year", "labor", "independence", "christmas"],
  US: ["new-year", "independence", "thanksgiving", "christmas"],
};

/** Los festivos de ese país en el año; el mismo `id` es el mismo motivo en cada país. */
export const countryHolidays = (country: PackCountry, year: number): readonly Holiday[] => holidaysOf(country, year);

/**
 * Si la sede cierra ese día por festivo: el negocio dice en qué festivos cierra (por motivo) y cada sede
 * los mira en el calendario de su país. En EE. UU. cuenta también el día observado.
 */
export function closedForHoliday(country: string | null | undefined, closedIds: readonly string[], date: string): Holiday | null {
  const code = packCountryOf(country);
  if (!code || closedIds.length === 0) return null;
  const year = Number(date.slice(0, 4));
  return countryHolidays(code, year).find((item) => closedIds.includes(item.id) && (item.date === date || item.observedDate === date)) ?? null;
}

/** Los próximos festivos en que cierra una sede, desde `from` (incluido). */
export function upcomingClosures(country: string | null | undefined, closedIds: readonly string[], from: string, limit = 3): Holiday[] {
  const code = packCountryOf(country);
  if (!code) return [];
  const year = Number(from.slice(0, 4));
  return [...countryHolidays(code, year), ...countryHolidays(code, year + 1)]
    .filter((item) => closedIds.includes(item.id) && (item.observedDate ?? item.date) >= from)
    .slice(0, limit);
}

// ── Identificación fiscal ────────────────────────────────────────────────────────────────────────

const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** El dígito de verificación de un NIT colombiano (DIAN, módulo 11). */
export function nitCheckDigit(base: string): number {
  const digits = base.replace(/\D/g, "").split("").reverse();
  const sum = digits.reduce((total, digit, index) => total + Number(digit) * (NIT_WEIGHTS[index] ?? 0), 0);
  const rest = sum % 11;
  return rest > 1 ? 11 - rest : rest;
}

/** NIT con su dígito de verificación: «900123456-8» o «9001234568» (el último dígito es el de verificación). */
function validNit(value: string): boolean {
  const clean = value.replace(/[\s.]/g, "");
  const match = /^(\d{6,14})-?(\d)$/.exec(clean);
  return Boolean(match && nitCheckDigit(match[1]) === Number(match[2]));
}

/** RFC del SAT: 3 letras (persona moral) o 4 (física), la fecha AAMMDD y la homoclave de 3. */
function validRfc(value: string): boolean {
  const match = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z\d]{3})$/.exec(value.replace(/[\s-]/g, "").toUpperCase());
  if (!match) return false;
  const month = Number(match[3]);
  const date = Number(match[4]);
  return month >= 1 && month <= 12 && date >= 1 && date <= 31;
}

/** Los prefijos de EIN que el IRS no asigna. */
const EIN_UNUSED = new Set(["00", "07", "08", "09", "17", "18", "19", "28", "29", "49", "69", "70", "78", "79", "89", "96", "97"]);

/** EIN del IRS: nueve dígitos, «12-3456789». */
function validEin(value: string): boolean {
  const match = /^(\d{2})-?(\d{7})$/.exec(value.replace(/\s/g, ""));
  return Boolean(match && !EIN_UNUSED.has(match[1]));
}

const TAX_ID_CHECKS: Readonly<Record<TaxIdKind, (value: string) => boolean>> = { nit: validNit, rfc: validRfc, ein: validEin };

/** Si la identificación fiscal tiene la forma de su país. Vacía vale (no es obligatoria); sin país, cualquier cosa. */
export function isValidTaxId(country: string | null | undefined, value: string): boolean {
  const pack = packOf(country);
  if (!value.trim() || !pack) return true;
  return TAX_ID_CHECKS[pack.taxIdKind](value.trim());
}

/**
 * El impuesto habitual del país entre los que ya existen: el que se llama igual o, si no, uno con el mismo total y
 * el mismo nombre de tasa («IVA Colombia», 19 %). Así no se duplica uno que la barbería ya creó a su manera.
 */
export function findUsualTaxGroup<T extends { name: string; taxes: readonly { name: string; percent: number }[] }>(country: PackCountry, groups: readonly T[]): T | undefined {
  const usual = COUNTRY_PACKS[country].taxGroup;
  if (!usual) return undefined;
  const total = (taxes: readonly { percent: number }[]) => taxes.reduce((sum, tax) => sum + tax.percent, 0);
  const rateNames = new Set(usual.taxes.map((tax) => tax.name.toLowerCase()));
  return (
    groups.find((group) => group.name.toLowerCase() === usual.name.toLowerCase()) ??
    groups.find((group) => total(group.taxes) === total(usual.taxes) && group.taxes.every((tax) => rateNames.has(tax.name.toLowerCase())))
  );
}

// ── La sucursal de arranque ──────────────────────────────────────────────────────────────────────

export interface BranchDefaults {
  currency: string;
  timezone: string;
  language: string;
}

/**
 * Lo que cambia al elegir el país de una sucursal: moneda, zona (si la que tenía no es de allí) e idioma.
 * El impuesto y la pasarela se proponen aparte, porque dependen de lo que la barbería ya tiene creado.
 */
export function branchDefaultsFor(country: PackCountry, current?: Partial<BranchDefaults>): BranchDefaults {
  const pack = COUNTRY_PACKS[country];
  const timezone = current?.timezone && pack.timezones.includes(current.timezone) ? current.timezone : pack.timezones[0];
  return { currency: pack.currency, timezone, language: current?.language || pack.language };
}
