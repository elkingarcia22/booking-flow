/**
 * Los datos de ejemplo de la demo (reseñas de barberos, el embudo de la reserva) se ven solo mientras
 * esto esté encendido, y siempre marcados como ejemplo: nunca se mezclan con los reales. Se apaga con
 * `VITE_SAMPLE_DATA=false` (una barbería piloto sobre el backend simulado, o para revisar cómo se ve
 * una barbería nueva). El backend real no tiene datos de ejemplo.
 */
export const sampleDataOn = (): boolean => import.meta.env.VITE_SAMPLE_DATA !== "false";
