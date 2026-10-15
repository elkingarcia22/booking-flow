import { MAX_REFERENCE_PHOTOS } from "./flow/referencePhoto";
import type { Promo } from "./pricing";
import type { BookingCustomer, LastVisit, PayMethod, Reservation, WaitlistJoined } from "./types";

/**
 * El recorrido de la reserva como datos: en qué paso está, quién reserva, la
 * cita que se está armando y las que ya están en el carrito. Sin interfaz,
 * para poder probarlo entero; la pantalla solo despacha acciones.
 *
 * Una reserva tiene una sede y una o varias citas. Cada cita es de una
 * persona —quien reserva, un invitado guardado (su hijo, su pareja) o alguien
 * nuevo por nombre— con uno o varios servicios, un barbero (o sin
 * preferencia) y una hora.
 */

export type BookingStep = "phone" | "verify" | "gift" | "packages" | "profile" | "welcome" | "blocked" | "branch" | "services" | "barber" | "time" | "review" | "payment" | "confirmed" | "waitlisted" | "manage";

export type BookingPerson = { kind: "self" } | { kind: "guest"; guestId: string; name: string; relation: string } | { kind: "new"; name: string; relation: string };

export interface DraftItem {
  key: string;
  person: BookingPerson;
  serviceIds: string[];
  /** `null` = sin preferencia. */
  barberId: string | null;
  /** Ya se eligió con quién, aunque sea «Sin preferencia»: hasta entonces la agenda deja el campo vacío. */
  barberChosen?: boolean;
  /** «AAAA-MM-DDTHH:mm», o nada mientras no se elige. */
  start: string | null;
  /**
   * Sin preferencia: quién la hará según la agenda (el primero libre a esa hora, como asigna la
   * barbería). Solo para cobrar lo que cobra esa persona; al reservar se sigue enviando sin preferencia.
   */
  assignedBarberId?: string | null;
  /**
   * Las partes de una misma visita: un servicio separado de la cita para hacerlo con otro barbero
   * u otra hora. Una sola parte con `visitId` (se quitó la otra) se lee como una cita normal.
   */
  visitId?: string;
}

/** Una entrada de la lista de espera: lo que devolvió el servidor y lo que se pidió. */
export interface WaitlistEntry extends WaitlistJoined {
  branchId: string;
  serviceIds: readonly string[];
  /** `null` = con cualquier barbero. */
  barberId: string | null;
}

export interface BookingState {
  step: BookingStep;
  phone: string;
  /** A dónde se mandó el código («+57 •••• 2738» por WhatsApp), mientras se verifica. */
  codeSentTo: { sentTo: string; channel: "whatsapp" | "sms" } | null;
  /**
   * La sesión verificada con el código: todo lo que actúa en nombre del cliente (perfil, reserva,
   * tarjeta guardada, lista de espera, «Mis citas») la lleva. Empezar de nuevo la borra.
   */
  token: string | null;
  customer: BookingCustomer | null;
  /**
   * Confirmó con el código que el celular es suyo. El cliente de siempre se reconoce solo con el
   * número (`customerPreview`): ve su bienvenida, pero pagar, la lista de espera, «Mis citas», los
   * paquetes y las tarjetas de regalo piden el código.
   */
  verified: boolean;
  /**
   * Los datos de «Conozcámonos» del cliente nuevo, escritos sin código: su ficha se crea sola al
   * confirmar el código (al pagar, en la lista de espera o en «Mis citas»), sin volver a pedirlos.
   */
  pendingProfile: PendingProfile | null;
  branchId: string | null;
  items: DraftItem[];
  /** La cita que se está armando; `editingIndex` dice si reemplaza una del carrito. */
  draft: DraftItem | null;
  editingIndex: number | null;
  /**
   * La cita en curso se abrió desde el resumen («Agregar otra cita», «Cambiar»): «Atrás»
   * en servicios vuelve al resumen. Si no, «Atrás» recorre el flujo hacia el inicio.
   */
  fromReview: boolean;
  products: Readonly<Record<string, number>>;
  tipId: string | null;
  promo: Promo | null;
  /** La tarjeta de regalo que se usa en esta reserva y su saldo. */
  gift: { code: string; balance: number } | null;
  /** Usar la cortesía de cliente frecuente en esta reserva (si tiene una). Por defecto, sí. */
  useReward: boolean;
  /** Pagar con las visitas de sus paquetes las citas que estos cubren. Por defecto, sí. */
  usePackages: boolean;
  method: PayMethod | null;
  notes: string;
  /** Foto del corte que quiere (data URL ya reducida), para el barbero. */
  /** Fotos del corte que quiere (data URL), hasta `MAX_REFERENCE_PHOTOS`. */
  referencePhotos: readonly string[];
  reservation: Reservation | null;
  /** La tarjeta con la que se va a pagar («Visa •••• 4242»), para mostrarla en el resumen. */
  payCard: string | null;
  /** Dónde se apuntó en la lista de espera durante esta reserva. Apuntarse lleva a su confirmación. */
  waitlist: readonly WaitlistEntry[];
  /**
   * El carrito antes de separar o juntar una visita: si la cita en curso se descarta, vuelve tal
   * cual (el servicio separado regresa a su cita). Se olvida al guardar la cita.
   */
  undoItems?: DraftItem[] | null;
  /**
   * «Cada servicio con su barbero u hora», elegido en Servicios: los que faltan por armar, en
   * orden. Al guardar una parte se abre la siguiente, desde el barbero.
   */
  pendingParts?: string[];
  /** Se va armando parte por parte desde «por separado»: «Atrás» desde una parte vuelve a la anterior. */
  partQueue?: boolean;
}

export interface PendingProfile {
  firstName: string;
  lastName: string;
  email: string;
  marketing: boolean;
}

export type BookingAction =
  | { type: "phoneEntered"; phone: string }
  /**
   * El celular de un cliente nuevo, sin código: «Conozcámonos» y a armar la cita; el código se pide al
   * pagar (`PaymentStep`), en la lista de espera o en «Mis citas».
   */
  | { type: "startWithPhone"; phone: string; askProfile: boolean; onlyBranchId: string | null }
  /** El cliente de siempre, reconocido por su celular sin código: su bienvenida, con una sesión de vista previa. */
  | { type: "customerPreview"; phone: string; customer: BookingCustomer; token: string }
  /** «Conozcámonos» sin código: se guardan sus datos y sigue a armar la cita. */
  | { type: "profileDrafted"; profile: PendingProfile; onlyBranchId: string | null }
  /** Verificó el código siendo nuevo, sin moverse de pantalla (en el pago): falta su ficha. */
  | { type: "verifiedNew"; token: string }
  | { type: "codeSent"; phone: string; sentTo: string; channel: "whatsapp" | "sms" }
  | { type: "setToken"; token: string | null }
  | { type: "customerFound"; customer: BookingCustomer; token: string }
  | { type: "customerIsNew"; token: string }
  | { type: "customerBlocked" }
  | { type: "profileSaved"; customer: BookingCustomer; onlyBranchId: string | null }
  | { type: "startFresh"; onlyBranchId: string | null }
  | { type: "repeatLastVisit"; lastVisit: LastVisit }
  | { type: "acceptSuggestion"; branchId: string; serviceIds: string[]; barberId: string; start: string }
  | { type: "chooseBranch"; branchId: string }
  | { type: "setPerson"; person: BookingPerson }
  /** Cambia para quién es una cita ya apartada (en el checkout). */
  | { type: "setItemPerson"; key: string; person: BookingPerson }
  | { type: "toggleService"; serviceId: string }
  | { type: "chooseBarber"; barberId: string | null }
  | { type: "chooseTime"; start: string; /** Sin preferencia: el primero libre a esa hora. */ assignedBarberId?: string | null }
  | { type: "addAnother"; person: BookingPerson }
  /**
   * Abre una cita en borrador sin moverse de paso: la usan las versiones que no
   * van pantalla por pantalla (la agenda, la conversación).
   */
  | { type: "openDraft"; person: BookingPerson; serviceIds: readonly string[]; barberId: string | null; barberChosen?: boolean; /** Sigue en la misma visita (la Agenda, al reabrir la parte que se elige). */ visitId?: string }
  | { type: "editItem"; index: number }
  | { type: "removeItem"; index: number }
  | { type: "restoreItem"; index: number; item: DraftItem }
  | { type: "discardDraft" }
  /** «Atrás» desde el resumen: reabre la última cita en su hora, para retocarla. */
  | { type: "reopenLast" }
  | { type: "setProduct"; productId: string; qty: number }
  | { type: "setTip"; tipId: string | null }
  | { type: "setPromo"; promo: Promo | null }
  | { type: "setGift"; gift: { code: string; balance: number } | null }
  | { type: "setUseReward"; useReward: boolean }
  | { type: "setUsePackages"; usePackages: boolean }
  | { type: "setMethod"; method: PayMethod }
  | { type: "setPayCard"; card: string | null }
  | { type: "setNotes"; notes: string }
  | { type: "addReferencePhoto"; photo: string }
  | { type: "removeReferencePhoto"; index: number }
  | { type: "goTo"; step: BookingStep }
  | { type: "reserved"; reservation: Reservation }
  | { type: "bookAgain" }
  | { type: "openManage" }
  | { type: "signedIn"; customer: BookingCustomer; token: string }
  /** El perfil cambió sin moverse de pantalla (p. ej. editó o quitó una tarjeta). */
  | { type: "customerUpdated"; customer: BookingCustomer }
  /** «No soy yo» cuando el carrito ya está armado (la agenda pide los datos al final): olvida quién es y conserva las citas. */
  | { type: "signOut" }
  | { type: "waitlistJoined"; entry: WaitlistEntry }
  | { type: "waitlistLeft"; id: string }
  | { type: "restart" }
  /** Saca un servicio de su cita a una parte propia de la visita, con su barbero y su hora. */
  | { type: "splitService"; index: number; serviceId: string }
  /** Junta las partes de una visita en una sola cita, y pide la hora de nuevo. */
  | { type: "joinVisit"; visitId: string }
  /** Desde Servicios: cada servicio elegido va en su propia parte de la visita, uno tras otro. */
  | { type: "bookSeparately" }
  /** «Juntar todo» desde la parte en curso: la visita entera vuelve a ser una sola cita, desde el barbero. */
  | { type: "exitVisit" }
  /** Desde una parte del «por separado», reabre la anterior (ya apartada) para corregirla. */
  | { type: "previousPart" }
  /** Desde una parte del «por separado», reabre una ya apartada en concreto («Editar» en su hoja). */
  | { type: "reopenPart"; key: string }
  /** «Empezar de nuevo» desde la cabecera: la reserva vuelve a cero, sin olvidar quién es ni la sede. */
  | { type: "startOver" }
  /** Deshacer el «empezar de nuevo»: la reserva como estaba. */
  | { type: "restoreState"; state: BookingState };

let keySeed = 0;
const nextKey = (): string => {
  keySeed += 1;
  return `item_${keySeed}`;
};

let visitSeed = 0;
/** Un id de visita que no use ninguna cita del carrito (el contador se reinicia al recargar el módulo). */
const nextVisitId = (items: readonly DraftItem[]): string => {
  const used = new Set(items.map((item) => item.visitId));
  do visitSeed += 1;
  while (used.has(`visit_${visitSeed}`));
  return `visit_${visitSeed}`;
};

const emptyDraft = (person: BookingPerson = { kind: "self" }): DraftItem => ({ key: nextKey(), person, serviceIds: [], barberId: null, start: null });

export function initialBookingState(defaultTipId: string | null = null): BookingState {
  return { step: "phone", phone: "", codeSentTo: null, token: null, customer: null, verified: false, pendingProfile: null, branchId: null, items: [], draft: null, editingIndex: null, fromReview: false, products: {}, tipId: defaultTipId, promo: null, gift: null, useReward: true, usePackages: true, method: null, notes: "", referencePhotos: [], reservation: null, payCard: null, waitlist: [] };
}

/** Con una sola sede se salta el paso: se elige sola. */
const afterIdentity = (state: BookingState, onlyBranchId: string | null): BookingState =>
  onlyBranchId ? { ...state, branchId: onlyBranchId, draft: emptyDraft(), editingIndex: null, step: "services" } : { ...state, draft: emptyDraft(), editingIndex: null, step: "branch" };

/** Guarda la cita armada en el carrito (o reemplaza la que se editaba) y va al resumen. */
function commitDraft(state: BookingState, draft: DraftItem): BookingState {
  // Al final: la Agenda cuenta las citas guardadas por posición. El resumen agrupa las partes de una visita.
  const items = state.editingIndex === null ? [...state.items, draft] : state.items.map((item, index) => (index === state.editingIndex ? draft : item));
  const [nextService, ...rest] = state.pendingParts ?? [];
  if (nextService && draft.visitId) {
    // Quedan servicios por armar: la siguiente parte, desde el barbero. Para quién se elige en cada una
    // (puede ser otra persona: yo el corte, mi hijo el suyo); arranca en «Para mí».
    const next: DraftItem = { ...emptyDraft(), serviceIds: [nextService], visitId: draft.visitId };
    return { ...state, items, draft: next, editingIndex: null, fromReview: true, undoItems: null, pendingParts: rest, step: "barber" };
  }
  return { ...state, items, draft: null, editingIndex: null, fromReview: false, undoItems: null, pendingParts: [], partQueue: false, step: "review" };
}

/** Cada servicio elegido, su parte: se arma la primera y las demás esperan en `pendingParts`. */
function bookSeparately(state: BookingState): BookingState {
  const draft = state.draft;
  if (!draft || draft.serviceIds.length < 2) return state;
  const [first, ...rest] = draft.serviceIds;
  const part: DraftItem = { ...draft, serviceIds: [first], visitId: nextVisitId(state.items), barberId: null, barberChosen: false, start: null, assignedBarberId: null };
  return { ...state, draft: part, pendingParts: rest, partQueue: true, step: "barber" };
}

/** Es la primera parte de un «por separado» y aún no se guardó ninguna: se puede deshacer. */
function isFirstPendingPart(state: BookingState): boolean {
  const draft = state.draft;
  return Boolean(draft?.visitId && (state.pendingParts?.length ?? 0) > 0 && !state.items.some((item) => item.visitId === draft.visitId));
}

/** Deshace el «por separado» desde la primera parte: los servicios vuelven a estar juntos en una cita. */
function unsplitDraft(state: BookingState): BookingState {
  if (!state.draft || !isFirstPendingPart(state)) return state;
  return { ...state, draft: { ...state.draft, serviceIds: [...state.draft.serviceIds, ...(state.pendingParts ?? [])], visitId: undefined }, pendingParts: [], partQueue: false };
}

/**
 * Sale del «por separado» a mitad de camino: las partes ya guardadas, la de ahora y las que faltan
 * vuelven a ser una sola cita (para quien era la primera), y se elige barbero y hora para todo.
 */
function exitVisit(state: BookingState): BookingState {
  const draft = state.draft;
  if (!draft?.visitId) return state;
  const parts = state.items.filter((item) => item.visitId === draft.visitId);
  const serviceIds = [...new Set([...parts.flatMap((item) => item.serviceIds), ...draft.serviceIds, ...(state.pendingParts ?? [])])];
  const items = state.items.filter((item) => item.visitId !== draft.visitId);
  const together: DraftItem = { ...draft, serviceIds, person: parts[0]?.person ?? draft.person, visitId: undefined, barberId: null, barberChosen: false, start: null, assignedBarberId: null };
  return { ...state, items, draft: together, editingIndex: null, pendingParts: [], partQueue: false, undoItems: null, step: state.step === "time" ? "barber" : state.step };
}

/** La parte anterior ya apartada de esta visita, si se viene armando parte por parte. */
export function previousPartIndex(state: BookingState): number {
  const draft = state.draft;
  if (!draft?.visitId || !state.partQueue) return -1;
  return state.items.findLastIndex((item) => item.visitId === draft.visitId);
}

/**
 * Vuelve a la parte anterior para corregirla: sale del carrito y se reabre en su hora (con su barbero
 * y su persona); el servicio de ahora vuelve a la cola, el primero, y se arma al guardarla otra vez.
 */
function previousPart(state: BookingState): BookingState {
  const index = previousPartIndex(state);
  return index < 0 ? state : reopenPartAt(state, index, "time");
}

/**
 * Saca del carrito una parte ya apartada y la abre para cambiarla; la de ahora vuelve a la cola, la
 * primera, y se arma al guardarla otra vez. Las demás partes apartadas se quedan como están.
 */
function reopenPartAt(state: BookingState, index: number, step: BookingStep): BookingState {
  const draft = state.draft;
  const part = state.items[index];
  if (!draft?.visitId || !part || part.visitId !== draft.visitId) return state;
  // Desde aquí se sigue parte por parte (también si la visita salió de «Separar»): «Atrás» vuelve entre ellas.
  return { ...state, items: state.items.filter((_, at) => at !== index), draft: { ...part }, editingIndex: null, pendingParts: [...draft.serviceIds, ...(state.pendingParts ?? [])], partQueue: true, step };
}

/** Volver a Servicios desde la primera parte deshace el «por separado». */
const backToServices = (state: BookingState): BookingState => ({ ...unsplitDraft(state), step: "services" });

/** Separa un servicio: sale de su cita (que conserva barbero y hora) y abre su propia parte desde el barbero. */
function splitService(state: BookingState, index: number, serviceId: string): BookingState {
  const origin = state.items[index];
  if (!origin || origin.serviceIds.length < 2 || !origin.serviceIds.includes(serviceId)) return state;
  const visitId = origin.visitId ?? nextVisitId(state.items);
  const items = state.items.map((item, at) => (at === index ? { ...item, visitId, serviceIds: item.serviceIds.filter((id) => id !== serviceId) } : item));
  const draft: DraftItem = { ...emptyDraft(origin.person), serviceIds: [serviceId], visitId };
  return { ...state, items, draft, editingIndex: null, fromReview: true, undoItems: state.items, step: "barber" };
}

/** Junta las partes en la primera (con su barbero) y pide la hora: la cita ahora dura más. */
function joinVisit(state: BookingState, visitId: string): BookingState {
  const parts = state.items.filter((item) => item.visitId === visitId);
  const [first] = parts;
  if (!first || parts.length < 2) return state;
  const serviceIds = [...new Set(parts.flatMap((item) => item.serviceIds))];
  const items = state.items.filter((item) => item === first || item.visitId !== visitId);
  const draft: DraftItem = { ...first, serviceIds, visitId: undefined, start: null, assignedBarberId: null };
  return { ...state, items, draft, editingIndex: items.indexOf(first), fromReview: true, undoItems: state.items, step: "time" };
}

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case "phoneEntered":
      return { ...state, phone: action.phone };
    case "startWithPhone":
      // En Paso a paso el nuevo empieza por «Conozcámonos» (sin código); en la Agenda va directo a la cita
      // y sus datos se piden con el código.
      return action.askProfile
        ? { ...state, phone: action.phone, codeSentTo: null, token: null, customer: null, verified: false, pendingProfile: null, step: "profile" }
        : afterIdentity({ ...state, phone: action.phone, codeSentTo: null, token: null, customer: null, verified: false, pendingProfile: null }, action.onlyBranchId);
    case "profileDrafted":
      return afterIdentity({ ...state, pendingProfile: action.profile }, action.onlyBranchId);
    case "customerPreview":
      return { ...state, phone: action.phone, customer: action.customer, token: action.token, verified: false, codeSentTo: null, step: "welcome" };
    case "verifiedNew":
      return { ...state, customer: null, token: action.token, verified: true, codeSentTo: null };
    case "codeSent":
      return { ...state, phone: action.phone, codeSentTo: { sentTo: action.sentTo, channel: action.channel }, step: "verify" };
    case "setToken":
      return { ...state, token: action.token };
    case "customerFound":
      return { ...state, customer: action.customer, token: action.token, verified: true, codeSentTo: null, step: "welcome" };
    case "customerIsNew":
      return { ...state, customer: null, token: action.token, verified: true, codeSentTo: null, step: "profile" };
    case "customerBlocked":
      return { ...state, customer: null, token: null, verified: false, codeSentTo: null, step: "blocked" };
    case "profileSaved":
      return afterIdentity({ ...state, customer: action.customer }, action.onlyBranchId);
    case "startFresh":
      return afterIdentity(state, action.onlyBranchId);
    case "repeatLastVisit":
      return {
        ...state,
        branchId: action.lastVisit.branchId,
        draft: { ...emptyDraft(), serviceIds: [...action.lastVisit.serviceIds], barberId: action.lastVisit.barberId },
        editingIndex: null,
        step: "time",
      };
    case "acceptSuggestion":
      // La hora que le toca, propuesta por su frecuencia de visita: la cita queda armada y va al resumen.
      return {
        ...state,
        branchId: action.branchId,
        items: [{ ...emptyDraft(), serviceIds: [...action.serviceIds], barberId: action.barberId, start: action.start }],
        draft: null,
        editingIndex: null,
        step: "review",
      };
    case "chooseBranch":
      // Cambiar de sede vacía el carrito: los barberos y los precios son de cada sede.
      return { ...state, branchId: action.branchId, items: action.branchId === state.branchId ? state.items : [], products: action.branchId === state.branchId ? state.products : {}, draft: state.draft ?? emptyDraft(), step: "services" };
    case "setPerson":
      return state.draft ? { ...state, draft: { ...state.draft, person: action.person } } : state;
    case "setItemPerson":
      // Cada parte de una visita puede ser de alguien distinto (yo el corte, mi hijo el suyo).
      return { ...state, items: state.items.map((item) => (item.key === action.key ? { ...item, person: action.person } : item)) };
    case "toggleService": {
      if (!state.draft) return state;
      const has = state.draft.serviceIds.includes(action.serviceId);
      const serviceIds = has ? state.draft.serviceIds.filter((id) => id !== action.serviceId) : [...state.draft.serviceIds, action.serviceId];
      // Otros servicios pueden no hacerlos el mismo barbero ni caber en la misma hora: se vuelven a elegir.
      return { ...state, draft: { ...state.draft, serviceIds, start: null, assignedBarberId: null } };
    }
    case "chooseBarber":
      return state.draft ? { ...state, draft: { ...state.draft, barberId: action.barberId, barberChosen: true, start: null, assignedBarberId: null }, step: "time" } : state;
    case "chooseTime":
      return state.draft ? commitDraft(state, { ...state.draft, start: action.start, assignedBarberId: state.draft.barberId ? null : (action.assignedBarberId ?? null) }) : state;
    case "addAnother":
      return { ...state, draft: emptyDraft(action.person), editingIndex: null, fromReview: state.items.length > 0, step: "services" };
    case "openDraft":
      return { ...state, draft: { ...emptyDraft(action.person), serviceIds: [...action.serviceIds], barberId: action.barberId, barberChosen: action.barberChosen ?? action.barberId !== null, visitId: action.visitId }, editingIndex: null, fromReview: false };
    case "editItem": {
      const item = state.items[action.index];
      // Cambiar esa cita puntual, no volver a todos los servicios: abre en su barbero (con el suyo marcado)
      // y sigue a la hora; desde la hora, «Cambiar» lleva a los servicios si hace falta.
      return item ? { ...state, draft: { ...item }, editingIndex: action.index, fromReview: true, step: "barber" } : state;
    }
    case "reopenLast": {
      const index = state.items.length - 1;
      const item = state.items[index];
      return item ? { ...state, draft: { ...item }, editingIndex: index, fromReview: false, step: "time" } : state;
    }
    case "removeItem": {
      const items = state.items.filter((_, index) => index !== action.index);
      return { ...state, items, promo: items.length === 0 ? null : state.promo };
    }
    case "restoreItem": {
      const items = [...state.items.slice(0, action.index), action.item, ...state.items.slice(action.index)];
      return { ...state, items };
    }
    case "discardDraft": {
      // Al separar o juntar, descartar devuelve el carrito como estaba.
      const items = state.undoItems ?? state.items;
      return { ...state, items, draft: null, editingIndex: null, fromReview: false, undoItems: null, pendingParts: [], partQueue: false, step: items.length > 0 ? "review" : state.step };
    }
    case "bookSeparately":
      return bookSeparately(state);
    case "exitVisit":
      return exitVisit(state);
    case "previousPart":
      return previousPart(state);
    case "reopenPart":
      // Desde la hoja de las apartadas: se cambia desde el barbero (con el suyo ya marcado) y la hora.
      return reopenPartAt(state, state.items.findIndex((item) => item.key === action.key), "barber");
    case "startOver": {
      // Quien ya es cliente vuelve a su bienvenida; el nuevo, a elegir servicios (con su sede, si ya la tiene).
      const kept = { ...initialBookingState(state.tipId), phone: state.phone, token: state.token, customer: state.customer, verified: state.verified, pendingProfile: state.pendingProfile, branchId: state.branchId };
      return state.customer && !state.customer.isNew ? { ...kept, step: "welcome" } : { ...kept, draft: emptyDraft(), step: state.branchId ? "services" : "branch" };
    }
    case "restoreState":
      return action.state;
    case "splitService":
      return splitService(state, action.index, action.serviceId);
    case "joinVisit":
      return joinVisit(state, action.visitId);
    case "setProduct": {
      const rest = Object.fromEntries(Object.entries(state.products).filter(([id]) => id !== action.productId));
      return { ...state, products: action.qty > 0 ? { ...rest, [action.productId]: action.qty } : rest };
    }
    case "setTip":
      return { ...state, tipId: action.tipId };
    case "setPromo":
      return { ...state, promo: action.promo };
    case "setGift":
      return { ...state, gift: action.gift };
    case "setUseReward":
      return { ...state, useReward: action.useReward };
    case "setUsePackages":
      return { ...state, usePackages: action.usePackages };
    case "setMethod":
      return { ...state, method: action.method };
    case "setPayCard":
      return { ...state, payCard: action.card };
    case "setNotes":
      return { ...state, notes: action.notes };
    case "addReferencePhoto":
      return state.referencePhotos.length >= MAX_REFERENCE_PHOTOS ? state : { ...state, referencePhotos: [...state.referencePhotos, action.photo] };
    case "removeReferencePhoto":
      return { ...state, referencePhotos: state.referencePhotos.filter((_, index) => index !== action.index) };
    case "goTo":
      return action.step === "services" ? backToServices(state) : { ...state, step: action.step };
    case "reserved":
      return { ...state, reservation: action.reservation, step: "confirmed" };
    case "bookAgain":
      // Otra reserva para la misma persona: se queda quién es y en qué sede, lo demás vuelve a empezar.
      return { ...initialBookingState(state.tipId), phone: state.phone, token: state.token, customer: state.customer, verified: state.verified, branchId: state.branchId, draft: emptyDraft(), step: state.branchId ? "services" : "branch" };
    case "openManage":
      return { ...state, step: "manage" };
    case "signedIn":
      // Entró a «Mis citas» con su código: ya se sabe quién es, sin moverlo de pantalla.
      return { ...state, customer: action.customer, token: action.token, verified: true, phone: action.customer.phone.replace(/[^\d+]/g, "") || state.phone };
    case "customerUpdated":
      return { ...state, customer: action.customer, pendingProfile: null };
    case "signOut":
      return { ...state, phone: "", codeSentTo: null, token: null, customer: null, verified: false, pendingProfile: null, method: null, useReward: true, usePackages: true };
    case "waitlistJoined":
      // Apuntarse va directo a su confirmación: desde allí se sale de la lista, se buscan otras horas o,
      // si ya había una reserva armada, se vuelve a ella para pagarla.
      return { ...state, waitlist: [...state.waitlist.filter((entry) => entry.id !== action.entry.id), action.entry], step: "waitlisted" };
    case "waitlistLeft": {
      const waitlist = state.waitlist.filter((entry) => entry.id !== action.id);
      // Sin ninguna entrada no hay nada que confirmar: vuelve a buscar hora.
      return { ...state, waitlist, step: state.step === "waitlisted" && waitlist.length === 0 ? "time" : state.step };
    }
    case "restart":
      return initialBookingState(state.tipId);
  }
}

/** Los pasos que enseña la barra de progreso y en cuál de ellos cae cada pantalla. */
export const PROGRESS_STEPS = ["branch", "services", "barber", "time", "review", "payment"] as const;
export type ProgressStep = (typeof PROGRESS_STEPS)[number];

/**
 * Los pasos que cuentan para este cliente: la sede solo es un paso para quien la
 * elige (cliente nuevo con varias sedes). Quien ya viene o una barbería de una sola
 * sede empieza en «Servicios», así que contarla sería un paso que nunca ve.
 */
export function progressSteps(withBranch: boolean): readonly ProgressStep[] {
  return withBranch ? PROGRESS_STEPS : PROGRESS_STEPS.filter((step) => step !== "branch");
}

export function progressIndex(step: BookingStep, steps: readonly ProgressStep[] = PROGRESS_STEPS): number {
  const index = steps.indexOf(step as ProgressStep);
  if (index !== -1) return index;
  return step === "confirmed" ? steps.length : -1;
}

/** El nombre de quien va a la cita, como lo leen el resumen y el recibo. */
export function personName(person: BookingPerson, customer: BookingCustomer | null): string {
  if (person.kind === "self") return customer?.name ?? "";
  return person.name;
}

/**
 * La sede que se da por hecha: la única que hay o, para quien ya es cliente,
 * donde vino la última vez. `null` pide elegir (cliente nuevo con varias sedes).
 * Quien ya viene no vuelve a elegir sede al reservar: la ajusta en el resumen.
 */
export function defaultBranchId(customer: BookingCustomer | null, branchIds: readonly string[]): string | null {
  if (branchIds.length === 1) return branchIds[0];
  const known = customer && !customer.isNew ? customer.lastVisit?.branchId : undefined;
  return known && branchIds.includes(known) ? known : null;
}
