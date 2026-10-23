import type * as React from "react";

/**
 * El modelo que comparten las piezas de agenda: quién atiende (un recurso,
 * en la barbería un barbero), qué pasa en su columna (una cita o un bloqueo)
 * y con qué tono se pinta. Es deliberadamente agnóstico del dominio: la
 * pantalla traduce sus citas a esto y las piezas no saben de clientes ni de
 * precios, solo de bloques con hora de inicio y fin.
 */

/** Una franja de trabajo del día, en «HH:mm». */
export interface ScheduleWorkingHours {
  start: string;
  end: string;
}

/** `accent` es el sexto color sin significado de estado: el índigo (ciruela en Oro) del tono neutro del sistema. */
export type ScheduleTone = "primary" | "positive" | "warning" | "negative" | "info" | "neutral" | "accent";

/** El relleno de una tarjeta: sobrio, el pastel de su color de categoría o el de su tono. */
export type ScheduleFill = "neutral" | "category" | "tone";

/** Un aviso bajo el nombre de un recurso: «Hueco 15:00 · 2 en espera». */
export interface ScheduleResourceAlert {
  label: string;
  tone?: ScheduleTone;
  onClick?: () => void;
}

export interface ScheduleResource {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Una línea bajo el nombre: el horario, cuántas citas lleva. */
  subtitle?: string;
  /** Franjas en las que trabaja ese día; vacío o ausente es «no trabaja». */
  workingHours?: readonly ScheduleWorkingHours[];
  /** Cuánto de la jornada está ocupado, de 0 a 1: una barra bajo el nombre. */
  progress?: number;
  /** Algo que la columna pide mirar ahora: se pinta como chip bajo el nombre. */
  alert?: ScheduleResourceAlert;
  /**
   * El día que enseña la columna cuando no es el de la rejilla: la semana de una
   * sola persona, una columna por día. La cabecera pasa a ser el día (semana y
   * número, hoy resaltado) en vez del avatar, y las citas, los huecos y la línea
   * de «ahora» son los de ese día.
   */
  date?: Date;
}

export type ScheduleEventKind = "appointment" | "block";

export interface ScheduleEventAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

/** Los iconos pequeños de la esquina de una tarjeta. Son conceptos, no iconos: la tarjeta decide cuál dibuja. */
export type ScheduleMarkerIcon = "online" | "walkIn" | "new" | "note" | "paid" | "repeat" | "requested" | "confirmed" | "risk" | "reschedule" | "declined";

export interface ScheduleMarker {
  id: string;
  /** Lo que significa, para el tooltip y el lector de pantalla. */
  label: string;
  icon: ScheduleMarkerIcon;
}

export interface ScheduleEvent {
  id: string;
  resourceId: string;
  start: Date;
  end: Date;
  /** Una cita ocupa la columna con su tarjeta; un bloqueo la tacha. */
  kind?: ScheduleEventKind;
  title: string;
  subtitle?: string;
  /** Una tercera línea: el barbero, una nota. */
  detail?: string;
  /** El color de la tarjeta cuando sale de los colores del tema. */
  tone?: ScheduleTone;
  /**
   * El color de la tarjeta tomado de la paleta categórica (1 a 12): para
   * distinguir muchas cosas a la vez —en la barbería, un color por servicio—.
   * Si viene, manda sobre `tone`.
   */
  color?: number;
  /**
   * Cómo se rellena la tarjeta: `neutral` (por defecto) es el relleno sobrio de
   * siempre con el color solo en el punto; `category` la tiñe con el pastel de
   * `color`; `tone`, con el pastel de `tone`. Los pasteles los da el tema.
   */
  fill?: ScheduleFill;
  /** Etiqueta corta junto al título: quién es (el tipo de cliente). */
  badge?: { label: string; tone?: ScheduleTone };
  /** En qué va ahora mismo («Ya ingresó», «En silla», «Por cobrar»): una píldora con su punto de color. */
  status?: { label: string; tone?: ScheduleTone };
  /** El siguiente paso de la tarjeta: «Ingresar», «Cobrar». */
  action?: ScheduleEventAction;
  /** Algo que revisar; se muestra como icono con tooltip. */
  warning?: string;
  /** Algo que corre prisa ahora mismo («12 min tarde»): una pastilla roja. */
  urgent?: string;
  /** Los iconos de la esquina: de dónde vino, si es nuevo, si tiene nota… */
  markers?: readonly ScheduleMarker[];
  /** No enseñar la línea de la hora (la persona la apagó; sigue en el tooltip). */
  hideTime?: boolean;
  /** Fuera del filtro activo: se queda en su sitio, pero apagada. */
  faded?: boolean;
  /** Ya pasó o se anuló: se atenúa y se tacha. */
  muted?: boolean;
  /** No se puede arrastrar ni estirar. Una cita cobrada enseña además un candado. */
  locked?: boolean;
  /**
   * Nadie la ha fijado —el cliente no pidió barbero, es interna—: el borde
   * va discontinuo para decir que se puede mover sin preguntar.
   */
  flexible?: boolean;
  /**
   * No existe todavía: es una propuesta (un hueco sugerido, a dónde iría una
   * cita si se reacomoda). Se dibuja translúcida y con borde discontinuo, no
   * se arrastra y tocarla es aceptar la propuesta.
   */
  ghost?: boolean;
  /**
   * Con `ghost`: es la que se está armando ahora mismo (el hueco elegido en
   * «Crear cita», la ausencia o el bloqueo que se agrega). Se dibuja opaca
   * —tapa lo de debajo para que los textos no se encimen—, con el borde
   * discontinuo más grueso y un halo, para que se vea dónde va a quedar.
   */
  active?: boolean;
  /** Por qué se propone («Sin dejar hueco entre citas»): una línea bajo el título. */
  note?: string;
  /**
   * Una sola cita con varios servicios: sus tramos en orden («Corte clásico ·
   * 30 min», «Arreglo de barba · 30 min»). La tarjeta ocupa un solo hueco y una
   * línea fina marca por dentro dónde empieza cada servicio. No es un grupo:
   * un grupo son citas aparte.
   */
  segments?: readonly ScheduleEventSegment[];
  /** Un dato corto en la fila de abajo, junto al estado (el total de una cita de varios servicios). */
  meta?: string;
  /**
   * Es parte de un grupo de citas enlazadas (salieron de un mismo
   * agendamiento o se enlazaron a mano). La tarjeta lleva un icono de enlace
   * con «1/2» en el color del grupo; con `highlight`, además un borde
   * discontinuo de ese color. `joinTop`/`joinBottom` la pegan a la de arriba
   * o abajo de la misma columna, para que se lean como un solo bloque.
   */
  group?: ScheduleEventGroup;
}

export interface ScheduleEventSegment {
  id: string;
  label: string;
  /** Cuánto dura: el tramo ocupa esa parte del alto de la tarjeta. */
  minutes: number;
  /** El color de su servicio (paleta categórica): un círculo junto a su nombre. */
  color?: number;
}

export interface ScheduleEventGroup {
  id: string;
  index: number;
  size: number;
  /** El color del grupo (paleta categórica): tiñe el icono de enlace y, resaltado, el borde. */
  color?: number;
  /** Resaltar el grupo: borde discontinuo de su color alrededor de cada una de sus tarjetas. */
  highlight?: boolean;
  joinTop?: boolean;
  joinBottom?: boolean;
}

/** Dónde soltó alguien una tarjeta: la columna y la hora nuevas. */
export interface ScheduleDrop {
  resourceId: string;
  start: Date;
  end: Date;
}

/**
 * Si un destino vale. Devuelve `null` cuando sí y, si no, el motivo en una
 * frase («Se pisa con Marcela Gómez»): la rejilla lo enseña mientras se
 * arrastra y no suelta la tarjeta ahí.
 */
export type ScheduleDropValidator = (event: ScheduleEvent, drop: ScheduleDrop) => string | null;

/** Un hueco libre que alguien tocó. */
export interface ScheduleSlot {
  resourceId: string;
  start: Date;
  /** Si el recurso trabaja a esa hora. */
  isWorking: boolean;
}

/** Acción del menú de un recurso (la columna de un barbero). */
export interface ScheduleResourceAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}
