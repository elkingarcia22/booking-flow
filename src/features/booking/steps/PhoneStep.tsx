import { CoverEntry } from "./entry/CoverEntry";

/**
 * La puerta: el celular. Se le manda un código —a cualquier número, para que
 * escribir un celular ajeno no revele si es cliente ni sus datos— y solo al
 * verificarlo se sabe si es alguien que vuelve, alguien nuevo o un número bloqueado.
 * La entrada es la «Portada»: la foto de la barbería, el celular, los atajos y las sedes.
 * `askProfile`: el cliente nuevo pasa por «Conozcámonos» antes de la cita (Paso a paso); sin él va
 * directo a la cita y sus datos se piden con el código (la Agenda).
 */
export function PhoneStep({ askProfile = true }: { askProfile?: boolean }) {
  return <CoverEntry askProfile={askProfile} />;
}
