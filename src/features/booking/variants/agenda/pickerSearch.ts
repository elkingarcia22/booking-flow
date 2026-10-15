/** Desde cuántas opciones la lista de una hoja lleva buscador. */
export const PICKER_SEARCH_FROM = 7;

/** Sin tildes ni mayúsculas, para buscar «andres» y encontrar «Andrés». */
export const plainText = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
