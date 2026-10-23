import { SERVICES } from "../calendar/seed";
import { SERVICE_PHOTOS } from "../media";

/**
 * El catálogo de servicios del backend simulado. Parte de los mismos
 * servicios que usa la agenda (`calendar/seed`), con los mismos ids, y les
 * añade lo que la agenda no necesita: costo, impuesto, si se reserva en
 * línea, en qué sucursales está activo y, en los combos, qué servicios
 * incluye. Desde aquí lee el calendario lo que se puede agendar.
 */

export type MockServiceKind = "service" | "combo";
export type MockVisibility = "public" | "private";
export type MockPrepPosition = "start" | "end";

export interface MockServiceCategory {
  id: string;
  name: string;
  description: string;
  visibility: MockVisibility;
}

export interface MockCatalogService {
  id: string;
  kind: MockServiceKind;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  cost: number | null;
  durationMin: number;
  /** Porcentaje (0–100) o `null` si no lleva impuesto. */
  taxRate: number | null;
  /** El precio en cada sucursal que no usa el general (id de sucursal → precio). */
  branchPrices?: Record<string, number>;
  visibility: MockVisibility;
  /** Sucursales en las que se ofrece. */
  activeBranchIds: string[];
  /** Permite agendar otra cita mientras dura este servicio. */
  multiservice: boolean;
  prep: { enabled: boolean; minutes: number; position: MockPrepPosition };
  giftCards: boolean;
  /** Solo en combos: los servicios que agrupa. */
  includes: string[];
  /** La foto del servicio; `null` si aún no tiene. */
  imageUrl: string | null;
  createdAt: string;
}

export interface MockServiceResource {
  id: string;
  name: string;
  description: string;
  units: number;
  serviceIds: string[];
}

export interface MockServicesState {
  categories: MockServiceCategory[];
  items: MockCatalogService[];
  /** Los recursos especiales. Opcional: una base guardada antes de que existieran no los trae. */
  resources?: MockServiceResource[];
}

/** El local tiene un solo lavacabezas y un solo vaporizador: dos citas que los usan a la vez chocan. */
export function seedResources(): MockServiceResource[] {
  return [
    { id: "res_lavado", name: "Sillón de lavado", description: "El lavacabezas del fondo, para tratamientos y color.", units: 1, serviceIds: ["svc_tratamiento", "svc_premium", "svc_tinte"] },
    { id: "res_vapor", name: "Vaporizador de toallas", description: "Toallas calientes para el afeitado a navaja.", units: 1, serviceIds: ["svc_afeitado", "svc_premium"] },
  ];
}

/** La categoría a la que caen los servicios cuando se borra la suya. No se puede borrar. */
export const UNCATEGORIZED_ID = "cat_none";

const BRANCH_IDS = ["ma", "nc", "ri", "ut"];

const CATEGORY_IDS: Readonly<Record<string, string>> = { Cortes: "cat_cortes", Barba: "cat_barba", Combos: "cat_combos", Extras: "cat_extras" };

const CATEGORIES: readonly MockServiceCategory[] = [
  { id: "cat_cortes", name: "Cortes", description: "Todo lo que se hace con tijera y máquina.", visibility: "public" },
  { id: "cat_barba", name: "Barba", description: "Arreglo, perfilado y afeitado.", visibility: "public" },
  { id: "cat_combos", name: "Combos", description: "Varios servicios en una sola cita, a mejor precio.", visibility: "public" },
  { id: "cat_extras", name: "Extras", description: "Lo que se suma a un corte.", visibility: "public" },
  { id: UNCATEGORIZED_ID, name: "Sin categoría", description: "", visibility: "private" },
];

const COMBO_INCLUDES: Readonly<Record<string, string[]>> = {
  svc_combo: ["svc_corte", "svc_barba"],
  svc_premium: ["svc_fade", "svc_afeitado", "svc_tratamiento"],
};

/** Lo que cuesta dar el servicio, como parte del precio; `null` = no se ha registrado. */
const COST_SHARE: Readonly<Record<string, number | null>> = {
  svc_corte: 0.3,
  svc_fade: 0.3,
  svc_nino: 0.35,
  svc_barba: 0.25,
  svc_afeitado: 0.3,
  svc_combo: 0.28,
  svc_premium: 0.32,
  svc_cejas: null,
  svc_tratamiento: 0.45,
};

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  svc_corte: "Corte a tijera o máquina con lavado y peinado.",
  svc_fade: "Degradado a máquina con acabado a navaja.",
  svc_nino: "Corte para menores de 12 años.",
  svc_barba: "Perfilado y arreglo de barba con máquina y navaja.",
  svc_afeitado: "Afeitado a navaja con toalla caliente.",
  svc_combo: "Corte clásico y arreglo de barba en una sola cita.",
  svc_premium: "Fade, afeitado clásico y tratamiento capilar.",
  svc_cejas: "",
  svc_tratamiento: "Hidratación profunda con masaje capilar.",
};

const CREATED_AT = "2026-06-04T15:00:00.000Z";

const blank = (): Pick<MockCatalogService, "taxRate" | "visibility" | "activeBranchIds" | "multiservice" | "prep" | "giftCards" | "includes" | "imageUrl" | "createdAt"> => ({
  taxRate: null,
  visibility: "public",
  activeBranchIds: [...BRANCH_IDS],
  multiservice: false,
  prep: { enabled: false, minutes: 0, position: "start" },
  giftCards: true,
  includes: [],
  imageUrl: null,
  createdAt: CREATED_AT,
});

export function seedServices(): MockServicesState {
  const fromAgenda: MockCatalogService[] = SERVICES.map((service) => {
    const share = COST_SHARE[service.id] ?? null;
    return {
      ...blank(),
      id: service.id,
      kind: COMBO_INCLUDES[service.id] ? "combo" : "service",
      name: service.name,
      description: DESCRIPTIONS[service.id] ?? "",
      categoryId: CATEGORY_IDS[service.category] ?? UNCATEGORIZED_ID,
      price: service.price,
      cost: share === null ? null : Math.round(service.price * share),
      durationMin: service.durationMin,
      includes: COMBO_INCLUDES[service.id] ?? [],
      imageUrl: SERVICE_PHOTOS[service.id] ?? null,
      multiservice: service.id === "svc_tratamiento",
      prep: service.id === "svc_afeitado" ? { enabled: true, minutes: 5, position: "start" } : { enabled: false, minutes: 0, position: "start" },
    };
  });
  /* Dos que la agenda no conoce: uno que solo se vende en el local y otro que
     esta sucursal aún no activó. Así la lista enseña los dos estados. */
  const extras: MockCatalogService[] = [
    { ...blank(), id: "svc_tinte", kind: "service", name: "Tinte de cabello", description: "Color completo o cubrimiento de canas.", categoryId: "cat_extras", price: 70, cost: 30, durationMin: 60, visibility: "private", taxRate: 8, imageUrl: SERVICE_PHOTOS.svc_tinte ?? null },
    { ...blank(), id: "svc_cera", kind: "service", name: "Depilación con cera", description: "", categoryId: UNCATEGORIZED_ID, price: 20, cost: null, durationMin: 20, activeBranchIds: ["nc", "ri"] },
  ];
  return { categories: [...CATEGORIES], items: [...fromAgenda, ...extras], resources: seedResources() };
}
