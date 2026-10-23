import { PRODUCTS } from "../calendar/seed";
import { PRODUCT_PHOTOS } from "../media";

/**
 * El catálogo de productos del backend simulado. Parte de los mismos
 * productos que usa la agenda (`calendar/seed`), con los mismos ids, y les
 * añade lo que la venta en caja no necesita: precio de compra, SKU, marca,
 * distribuidor y en qué sucursales se vende. Desde aquí lee el calendario lo
 * que se puede cobrar.
 */

export type MockProductVisibility = "public" | "private";

export interface MockProductCategory {
  id: string;
  name: string;
  description: string;
}

export interface MockCatalogProduct {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  /** Precio de venta. */
  price: number;
  /** Precio de compra; `null` si no se ha registrado. */
  cost: number | null;
  /** Porcentaje (0–100) o `null` si no lleva impuesto. */
  taxRate: number | null;
  /** El precio en cada sucursal que no usa el general (id de sucursal → precio). */
  branchPrices?: Record<string, number>;
  sku: string | null;
  brand: string | null;
  distributor: string | null;
  /** Si el cliente lo ve y lo puede añadir al reservar en línea. */
  visibility: MockProductVisibility;
  /** Si los barberos pueden venderlo desde su caja. */
  sellable: boolean;
  /** Sucursales en las que se vende. */
  activeBranchIds: string[];
  /** La foto del producto; `null` si aún no tiene. */
  imageUrl: string | null;
  createdAt: string;
}

export interface MockProductsState {
  categories: MockProductCategory[];
  items: MockCatalogProduct[];
}

/** La categoría a la que caen los productos cuando se borra la suya. No se puede borrar. */
export const UNCATEGORIZED_PRODUCT_ID = "pcat_none";

const BRANCH_IDS = ["ma", "nc", "ri", "ut"];
const CREATED_AT = "2026-06-10T15:00:00.000Z";

const CATEGORY_IDS: Readonly<Record<string, string>> = { Styling: "pcat_styling", Barba: "pcat_barba", Cuidado: "pcat_cuidado", Accesorios: "pcat_accesorios" };

const CATEGORIES: readonly MockProductCategory[] = [
  { id: "pcat_styling", name: "Styling", description: "Ceras, pomadas y polvos para peinar." },
  { id: "pcat_barba", name: "Barba", description: "Aceites y bálsamos para el cuidado de la barba." },
  { id: "pcat_cuidado", name: "Cuidado", description: "Lavado e hidratación del cabello." },
  { id: "pcat_accesorios", name: "Accesorios", description: "Lo que no es cosmético." },
  { id: UNCATEGORIZED_PRODUCT_ID, name: "Sin categoría", description: "" },
];

interface Extra {
  description: string;
  /** El precio de compra como parte del de venta; `null` = sin registrar. */
  costShare: number | null;
  sku: string | null;
  brand: string | null;
  distributor: string | null;
}

const EXTRAS: Readonly<Record<string, Extra>> = {
  prd_cera: { description: "Fijación media con acabado mate.", costShare: 0.5, sku: "ST-CER-100", brand: "Johnny B", distributor: "Barber Supply Co." },
  prd_pomada: { description: "Brillo alto y fijación fuerte, base agua.", costShare: 0.5, sku: "ST-POM-100", brand: "Johnny B", distributor: "Barber Supply Co." },
  prd_polvo: { description: "Volumen y textura sin peso.", costShare: 0.45, sku: null, brand: "Tec Italy", distributor: null },
  prd_aceite: { description: "Hidrata y suaviza la barba.", costShare: 0.55, sku: "BR-ACE-030", brand: "Tec Italy", distributor: "Beauty Pro" },
  prd_balsamo: { description: "", costShare: null, sku: "BR-BAL-060", brand: null, distributor: null },
  prd_shampoo: { description: "Para uso diario, todo tipo de cabello.", costShare: 0.6, sku: "CU-SHA-250", brand: "Tec Italy", distributor: "Beauty Pro" },
  prd_acond: { description: "", costShare: 0.6, sku: "CU-ACO-250", brand: "Tec Italy", distributor: "Beauty Pro" },
  prd_toalla: { description: "Toalla de algodón con el logo de la barbería.", costShare: 0.4, sku: null, brand: null, distributor: null },
};

export function seedProducts(): MockProductsState {
  const fromAgenda: MockCatalogProduct[] = PRODUCTS.map((product) => {
    const extra = EXTRAS[product.id] ?? { description: "", costShare: null, sku: null, brand: null, distributor: null };
    return {
      id: product.id,
      name: product.name,
      description: extra.description,
      categoryId: CATEGORY_IDS[product.category] ?? UNCATEGORIZED_PRODUCT_ID,
      price: product.price,
      cost: extra.costShare === null ? null : Math.round(product.price * extra.costShare * 100) / 100,
      taxRate: null,
      sku: extra.sku,
      brand: extra.brand,
      distributor: extra.distributor,
      visibility: "public",
      sellable: true,
      activeBranchIds: [...BRANCH_IDS],
      imageUrl: PRODUCT_PHOTOS[product.id] ?? null,
      createdAt: CREATED_AT,
    };
  });
  /* Dos que la caja no conoce: uno de uso interno —no se vende— y otro que
     esta sucursal aún no activó. Así la lista enseña los dos estados. */
  const extras: MockCatalogProduct[] = [
    { id: "prd_locion", name: "Loción after shave", description: "Se usa en el servicio; no está a la venta.", categoryId: "pcat_barba", price: 15, cost: 8, taxRate: 8, sku: "BR-LOC-100", brand: "Johnny B", distributor: "Barber Supply Co.", visibility: "private", sellable: false, activeBranchIds: [...BRANCH_IDS], imageUrl: PRODUCT_PHOTOS.prd_locion ?? null, createdAt: CREATED_AT },
    { id: "prd_peine", name: "Peine de carbono", description: "", categoryId: UNCATEGORIZED_PRODUCT_ID, price: 9, cost: null, taxRate: null, sku: null, brand: null, distributor: null, visibility: "public", sellable: true, activeBranchIds: ["nc", "ri"], imageUrl: PRODUCT_PHOTOS.prd_peine ?? null, createdAt: CREATED_AT },
  ];
  return { categories: [...CATEGORIES], items: [...fromAgenda, ...extras] };
}
