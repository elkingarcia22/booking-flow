/**
 * Las fotos del backend simulado: el retrato de cada persona del equipo, la
 * foto de cada servicio y de cada producto, la galería de trabajos de los
 * barberos y el avatar de los clientes que subieron uno.
 *
 * Son fotos reales con licencia libre: las de Unsplash (images.unsplash.com,
 * recortadas por su CDN al tamaño que se pinta) y los retratos de
 * randomuser.me para clientes y usuarios. Como en la vida real, no todo el
 * mundo tiene foto: quien está invitado aún no subió la suya, uno de cada
 * tres clientes no tiene avatar y un par de fichas del catálogo siguen sin
 * imagen. Ahí la interfaz pinta iniciales o el icono.
 */

const UNSPLASH = "https://images.unsplash.com";

/** Un retrato cuadrado centrado en la cara. */
const portrait = (id: string): string => `${UNSPLASH}/${id}?w=160&h=160&fit=crop&crop=faces&auto=format&q=70`;
/** Una foto cuadrada de catálogo. */
const square = (id: string): string => `${UNSPLASH}/${id}?w=320&h=320&fit=crop&auto=format&q=70`;
/** Una foto vertical de galería. */
const tall = (id: string): string => `${UNSPLASH}/${id}?w=600&h=750&fit=crop&auto=format&q=70`;

/** El retrato de cada persona del equipo. Los invitados (team-09, team-15, team-25) aún no tienen. */
export const TEAM_PHOTOS: Readonly<Record<string, string>> = {
  "team-01": portrait("photo-1494790108377-be9c29b29330"),
  "team-02": portrait("photo-1757744705465-ea08b0ddc38a"),
  "team-03": portrait("photo-1662850886700-4ec19bd30d11"),
  "team-04": portrait("photo-1553521041-d168abd31de3"),
  "team-05": portrait("photo-1618049049816-43a00d5b0c3d"),
  "team-06": portrait("photo-1534180477871-5d6cc81f3920"),
  "team-07": portrait("photo-1625241152315-4a698f74ceb7"),
  "team-08": portrait("photo-1592621385645-e41659e8aabe"),
  "team-10": portrait("photo-1573497019236-17f8177b81e8"),
  "team-11": portrait("photo-1507003211169-0a1dd7228f2d"),
  "team-12": portrait("photo-1586266195531-76cfa365cb43"),
  "team-13": portrait("photo-1614321375197-c5083895b054"),
  "team-14": portrait("photo-1544725176-7c40e5a71c5e"),
  "team-16": portrait("photo-1668834894230-d2ba3e55baa9"),
  "team-17": portrait("photo-1581322929597-aa39ca1ccff7"),
  "team-18": portrait("photo-1631377307692-36a9b6ae3ef6"),
  "team-19": portrait("photo-1522075469751-3a6694fb2f61"),
  "team-20": portrait("photo-1701096351544-7de3c7fa0272"),
  "team-21": portrait("photo-1547558345-af5db4fe45ec"),
  "team-22": portrait("photo-1701096374092-bb70915fdc5c"),
  "team-23": portrait("photo-1556452578-f140ac938de9"),
  "team-24": portrait("photo-1607569708758-0270aa4651bd"),
  "team-26": portrait("photo-1582893561942-d61adcb2e534"),
  "team-27": portrait("photo-1562004760-aceed7bb0fe3"),
  "team-28": portrait("photo-1738913920284-f629b6e40611"),
  "team-29": portrait("photo-1583692331507-fc0bd348695d"),
  "team-30": portrait("photo-1738913920956-1e3a73b934bc"),
};

/** Trabajos para la galería de los barberos: cortes, fades, barbas. */
const WORK_PHOTOS: readonly string[] = [
  "photo-1647140655214-e4a2d914971f",
  "photo-1648221122323-572c13a31663",
  "photo-1672642150228-3fcd5826ec26",
  "photo-1593702275687-f8b402bf1fb5",
  "photo-1599011176306-4a96f1516d4d",
  "photo-1567894340315-735d7c361db0",
  "photo-1705976062088-5433328c2dcd",
  "photo-1521490214993-bfb6f7dc096d",
  "photo-1532710093739-9470acff878f",
  "photo-1635273051937-a0ddef9573b6",
  "photo-1503951914875-452162b0f3f1",
].map(tall);

/** La galería de un barbero: entre tres y cinco trabajos (el tope de la ficha), distintos según quién. */
export function galleryFor(index: number): string[] {
  const count = 3 + (index % 3);
  return Array.from({ length: count }, (_, offset) => WORK_PHOTOS[(index * 3 + offset) % WORK_PHOTOS.length]);
}

/** El texto de la nota de cita que promete foto: la semilla le pone la foto que dice traer. */
export const REFERENCE_PHOTO_NOTE = "Trae foto de referencia";

/**
 * Las fotos del corte que el cliente dice traer: una o dos de las de trabajos, según `roll`
 * (sale del id de la cita, no del dado, para no mover la agenda sembrada).
 */
export function referencePhotosFor(roll: number): string[] {
  const first = WORK_PHOTOS[roll % WORK_PHOTOS.length];
  return roll % 3 === 0 ? [first, WORK_PHOTOS[(roll + 4) % WORK_PHOTOS.length]] : [first];
}

/** La foto de cada servicio. La depilación con cera sigue sin foto: es la ficha a medio llenar. */
export const SERVICE_PHOTOS: Readonly<Record<string, string>> = {
  svc_corte: square("photo-1593702275687-f8b402bf1fb5"),
  svc_fade: square("photo-1568339434343-2a640a1a9946"),
  svc_nino: square("photo-1704072650662-76df3af134a7"),
  svc_barba: square("photo-1630827020718-3433092696e7"),
  svc_afeitado: square("photo-1733995471058-3d6ff2013de3"),
  svc_combo: square("photo-1629189784191-9afdcbcb0398"),
  svc_premium: square("photo-1653875700329-a7c8aca94c95"),
  svc_cejas: square("photo-1581003250898-36050e78fcd3"),
  svc_tratamiento: square("photo-1634449571010-02389ed0f9b0"),
  svc_tinte: square("photo-1524582603048-cdeb7f943d0a"),
};

/** La foto de cada producto. El bálsamo de barba no tiene: es la ficha a medio llenar. */
export const PRODUCT_PHOTOS: Readonly<Record<string, string>> = {
  prd_cera: square("photo-1775127741095-86ee33b6b385"),
  prd_pomada: square("photo-1542818279-04aa19d54f06"),
  prd_polvo: square("photo-1750780536033-483faf4d28b2"),
  prd_aceite: square("photo-1655394009794-df4f7cd8582a"),
  prd_shampoo: square("photo-1701992678972-d5a053ad0fb0"),
  prd_acond: square("photo-1766142167641-507c80e35eb9"),
  prd_toalla: square("photo-1638232928539-6e91c47ddec5"),
  prd_locion: square("photo-1615527061659-a864d22aa5ec"),
  prd_peine: square("photo-1773078280369-e9d39ac03209"),
};

/** Los nombres de pila femeninos de las semillas, para elegir el retrato. */
const FEMALE_NAMES = new Set([
  "Ana", "Antonia", "Camila", "Carolina", "Daniela", "Elena", "Gabriela", "Isabella", "Julieta", "Luciana",
  "María", "Mariana", "Marcela", "Paula", "Renata", "Sara", "Valentina", "Victoria",
]);

const isFemale = (fullName: string): boolean => FEMALE_NAMES.has(fullName.split(" ")[0] ?? "");

/** Un retrato de randomuser.me; el índice (0–99) elige la foto. */
const person = (fullName: string, index: number): string => `https://randomuser.me/api/portraits/${isFemale(fullName) ? "women" : "men"}/${index % 100}.jpg`;

/** Uno de cada tres no subió foto. */
const HAS_PHOTO_EVERY = 3;

/**
 * El avatar de un cliente a partir de su número (`cli_007` → 7): dos de cada
 * tres tienen foto, sin repetirse entre los primeros cien.
 */
export function clientPhoto(number: number, fullName: string): string | null {
  if (number % HAS_PHOTO_EVERY === 0) return null;
  return person(fullName, (number * 37) % 100);
}

/** El avatar de un usuario de la plantilla: lo mismo, con otra serie para no repetir caras. */
export function userPhoto(number: number, fullName: string): string | null {
  if (number % 4 === 3) return null;
  return person(fullName, (number * 53 + 11) % 100);
}

/** Las cuentas de entrada: la dueña es la misma persona que en Equipo. */
export const ACCOUNT_PHOTOS = {
  owner: TEAM_PHOTOS["team-01"],
  manager: "https://randomuser.me/api/portraits/men/75.jpg",
} as const;

/** 1 MB de imagen ≈ 1,4 M caracteres en base64. */
const MAX_IMAGE_CHARS = 1_400_000;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

/**
 * La foto que llega en un alta o una edición: un enlace https o una imagen
 * subida (data URL de hasta 1 MB). Cualquier otra cosa se descarta.
 */
export function imageOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_IMAGE_CHARS) return null;
  return DATA_URL.test(trimmed) || HTTPS_URL.test(trimmed) ? trimmed : null;
}
