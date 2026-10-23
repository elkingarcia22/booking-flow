/**
 * Recepción (Front Desk): los kioscos de cada sede y la fila de quien llega sin cita.
 * Ver docs/investigacion-modulos/16-front-desk.md y docs/API_CONTRACT.md («Recepción y kiosco»).
 */

/** Una tablet de recepción atada a una sede. Su token no es la sesión de nadie: se revoca sola. */
export interface MockKioskDevice {
  id: string;
  branchId: string;
  name: string;
  /** Lo que la tablet manda en `X-Kiosk-Token`. `null` mientras no se empareja. */
  token: string | null;
  /** El código de 6 dígitos para emparejarla (una vez, 10 minutos). */
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  createdAt: string;
  createdBy: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export type MockQueueStatus = "waiting" | "called" | "left" | "removed";

/** Alguien que llegó sin cita y espera turno hoy. */
export interface MockQueueEntry {
  id: string;
  branchId: string;
  /** AAAA-MM-DD de la sede. */
  day: string;
  firstName: string;
  /** Si lo dejó: para avisarle por mensaje y para unirlo a su ficha al llamarlo. */
  phone: string | null;
  clientId: string | null;
  serviceIds: string[];
  /** `null` = sin preferencia: lo toma a quien le toque. */
  barberId: string | null;
  status: MockQueueStatus;
  /** Cuándo se unió y por dónde: en línea (desde el enlace, aún de camino) o ya en el local (kiosco o recepción). */
  joinedAt: string;
  source: "online" | "kiosk" | "reception";
  /** Cuando se le llamó: con quién y en qué cita quedó. */
  calledAt: string | null;
  appointmentId: string | null;
  /** Cuando se fue sin atender o lo quitaron. */
  leftAt: string | null;
  /** Cuándo se le mandó «ya casi te toca» (una vez). */
  notifiedAt?: string | null;
}

export interface MockFrontDeskState {
  devices: MockKioskDevice[];
  queue: MockQueueEntry[];
  /** «sede:día» con la fila de muestra ya sembrada (solo en la demo del navegador). */
  demoDays?: string[];
}

export const emptyFrontDesk = (): MockFrontDeskState => ({ devices: [], queue: [] });
