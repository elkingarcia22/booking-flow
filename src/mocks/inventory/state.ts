/** El estado del inventario ligero; la lógica está en `stock.ts`. */

export type MockStockReason = "sale" | "online" | "return" | "receive" | "count" | "waste" | "internal";

export interface MockStockMovement {
  id: string;
  branchId: string;
  productId: string;
  /** Lo que cambió: negativo sale, positivo entra. */
  delta: number;
  /** Lo que quedó después. */
  onHand: number;
  reason: MockStockReason;
  /** La cita o la venta que lo movió. */
  ref: string | null;
  note: string;
  at: string;
  by: string;
}

export interface MockInventoryState {
  /** `sucursal:producto` → existencias y mínimo. Sin entrada, sale de la semilla. */
  levels: Record<string, { onHand: number; min: number }>;
  movements: MockStockMovement[];
}

export const emptyInventory = (): MockInventoryState => ({
  levels: {},
  movements: [],
});
