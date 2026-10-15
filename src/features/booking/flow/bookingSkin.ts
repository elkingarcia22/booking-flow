import * as React from "react";

/**
 * Con qué cara se pintan los pasos: «guided» (Paso a paso) o «agenda» (la de Agenda en lista: foto
 * arriba con el título en vidrio, la tira de días y las horas por franja). «Según el cliente» pinta
 * con la de la Agenda también los pasos del cliente nuevo, para que las dos mitades se vean iguales.
 */
export type BookingSkin = "guided" | "agenda";

export const BookingSkinContext = React.createContext<BookingSkin>("guided");

export const useBookingSkin = (): BookingSkin => React.useContext(BookingSkinContext);
