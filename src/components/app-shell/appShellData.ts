import type * as React from "react";
import {
  Home,
  UserSearch,
  GraduationCap,
  Gauge,
  Activity,
  ClipboardList,
  Megaphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Third-level leaf (inside a drilled panel). */
export interface NavLeaf {
  id: string;
  label: string;
  /** Ruta de la app; el shell la entrega en `onNavigate`. */
  path?: string;
}

/** Second-level item: with children it drills into its own panel. */
export interface NavChild {
  id: string;
  label: string;
  /** Una línea de contexto; la muestra la tarjeta del nivel al entrar. */
  description?: string;
  path?: string;
  children?: readonly NavLeaf[];
}

/** Root item: with children it behaves as an in-place accordion. */
export interface NavRoot {
  kind: "item";
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  path?: string;
  children?: readonly NavChild[];
}

export interface NavGroup {
  kind: "group";
  label: string;
}

export type NavEntry = NavRoot | NavGroup;

export const NAV_TREE: readonly NavEntry[] = [
  { kind: "item", id: "inicio", label: "Inicio", icon: Home },

  { kind: "group", label: "Productos" },
  {
    kind: "item",
    id: "seleccion",
    label: "Selección",
    icon: UserSearch,
    badge: "Nuevo",
    children: [
      { id: "seldash", label: "Dashboard" },
      { id: "vacantes", label: "Vacantes" },
      { id: "plantillas", label: "Plantillas" },
      { id: "creditos", label: "Créditos" },
    ],
  },
  {
    kind: "item",
    id: "aprendizaje",
    label: "Aprendizaje",
    icon: GraduationCap,
    children: [
      {
        id: "lms",
        label: "LMS Creator",
        description: "Crea y organiza tus cursos",
        children: [
          { id: "contenidos", label: "Contenidos" },
          { id: "categorias", label: "Categorías" },
          { id: "universidad", label: "Universidad corporativa" },
          { id: "lmsai", label: "LMS AI" },
        ],
      },
      {
        id: "planes",
        label: "Planes de Formación",
        children: [
          { id: "planesactivos", label: "Planes" },
          { id: "grupos", label: "Grupos" },
        ],
      },
      {
        id: "certificados",
        label: "Certificados",
        children: [
          { id: "certdescarga", label: "Descarga" },
          { id: "certconfig", label: "Configuración" },
        ],
      },
      { id: "reportes", label: "Reportes" },
    ],
  },
  {
    kind: "item",
    id: "desempeno",
    label: "Desempeño",
    icon: Gauge,
    children: [
      { id: "eval360", label: "Evaluaciones 360" },
      { id: "objetivos", label: "Objetivos" },
      { id: "matriztalento", label: "Matriz de talento" },
      { id: "encuestas", label: "Encuestas" },
    ],
  },
  { kind: "item", id: "diagnostico", label: "Diagnóstico", icon: Activity },

  { kind: "group", label: "Herramientas" },
  { kind: "item", id: "tareas", label: "Tareas", icon: ClipboardList },
  { kind: "item", id: "avisos", label: "Avisos", icon: Megaphone },
];

/** Un registro del producto tal y como lo lista la búsqueda general. */
export interface SearchRecord {
  id: string;
  title: string;
  /** Contexto que se lee tras el título: tipo, estado, cifras. */
  meta: readonly string[];
  /** Ruta a la que lleva; el shell la entrega en `onNavigate`. */
  path?: string;
}

/**
 * Registros de demostración para la búsqueda general del shell. Una app real
 * los sustituye por los suyos con `config.search`, igual que hace con las
 * notificaciones (ver docs/API_CONTRACT.md).
 */
export const SEARCH_RECORDS: readonly SearchRecord[] = [
  { id: "vac-analista", title: "Analista de datos", meta: ["vacante", "Entrevistas", "12 candidatos"] },
  { id: "cand-andres", title: "Andrés Malo", meta: ["candidato", "Analista de datos"] },
  { id: "vac-disenador", title: "Diseñador de producto", meta: ["vacante", "Publicada", "34 candidatos"] },
  { id: "curso-onboarding", title: "Onboarding comercial", meta: ["ruta", "4 semanas", "48 inscritos"] },
  { id: "enc-clima", title: "Encuesta de clima 2026", meta: ["encuesta", "En curso", "87 % de participación"] },
  { id: "ciclo-q3", title: "Objetivos Q3", meta: ["ciclo", "142 colaboradores"] },
];

/** Un destino de la navegación, con su ruta legible y su ruta de app. */
export interface NavigationPath {
  id: string;
  /** `["Selección", "Vacantes"]` se lee «Selección › Vacantes». */
  path: readonly string[];
  route?: string;
}

/**
 * Aplana el árbol de navegación en destinos para la búsqueda general.
 *
 * Solo entra lo que de verdad lleva a algún sitio: una raíz con hijos
 * despliega en vez de navegar, así que aporta sus hijos pero no a sí misma.
 */
export function navigationPaths(tree: readonly NavEntry[]): readonly NavigationPath[] {
  const destinations: NavigationPath[] = [];
  for (const entry of tree) {
    if (entry.kind !== "item") continue;
    if (!entry.children?.length) {
      destinations.push({ id: entry.id, path: [entry.label], route: entry.path });
      continue;
    }
    for (const child of entry.children) {
      if (!child.children?.length) {
        destinations.push({ id: child.id, path: [entry.label, child.label], route: child.path });
        continue;
      }
      for (const leaf of child.children) {
        destinations.push({ id: leaf.id, path: [entry.label, child.label, leaf.label], route: leaf.path });
      }
    }
  }
  return destinations;
}

/**
 * El espacio de trabajo activo: una empresa, una sucursal, una sede… El shell
 * no decide cuál de esas cosas es —lo dice `ShellConfig.workspaceLabels`—, solo
 * sabe pintarlo y cambiarlo.
 */
export interface Company {
  id: string;
  name: string;
  /** Single-letter mark when there is no logo. */
  initial: string;
  /** Color de la marca. Sin él, la marca usa el color del tema. */
  bg?: string;
  /** Whether the mark renders the Google logo instead of the initial. */
  isGoogle?: boolean;
  /** Plan contratado; lo muestra el submenú de cambio de empresa. */
  plan?: string;
  /**
   * La línea que se lee bajo el nombre. Sin ella se cae al número de
   * personas de `licenses`, que no toda instalación tiene: una sucursal se
   * describe por su dirección, no por su plan.
   */
  meta?: string;
  /** Consumo contratado; solo lo pintan los productos que venden licencias. */
  licenses?: readonly [number, number];
  credits?: readonly [number, number];
}

export const COMPANIES: readonly Company[] = [
  { id: "google", name: "Google", initial: "G", bg: "#FFFFFF", isGoogle: true, plan: "Empresa", licenses: [940, 1000], credits: [25000, 45000] },
  { id: "alpha", name: "Alpha Logística", initial: "AL", bg: "#2E6BFF", plan: "Crecimiento", licenses: [128, 150], credits: [4200, 10000] },
  { id: "beta", name: "Beta Retail", initial: "BR", bg: "#7A5AF8", plan: "Empresa", licenses: [312, 400], credits: [18500, 20000] },
  { id: "omega", name: "Omega Salud", initial: "OS", bg: "#E0457B", plan: "Esencial", licenses: [76, 100], credits: [1900, 5000] },
];

export const COMPANY_MENU_LINKS: readonly string[] = [
  "Gestión de usuarios",
  "Personalización",
  "Organigrama",
  "Datos de empresa",
  "Roles y permisos",
];

/**
 * Un ajuste de la plataforma. No es navegación de producto: es lo que se
 * configura una vez y no se visita a diario, así que vive en su propio menú
 * de la cabecera y no en el árbol del sidebar.
 */
export interface SettingsItem {
  id: string;
  label: string;
  /** Una línea de qué se ajusta ahí; la muestra la página de configuración. */
  description?: string;
  /** Ruta de la app; el shell la entrega en `onNavigate`. */
  path?: string;
  /** `danger` para lo irreversible (eliminar la cuenta). */
  tone?: "default" | "danger";
}

export interface SettingsGroup {
  id: string;
  label: string;
  /** El glifo de la fila que abre el grupo en el menú de la marca. */
  icon?: LucideIcon;
  items: readonly SettingsItem[];
}

/** Ajustes de demostración; la app real inyecta los suyos vía `ShellConfig.settings`. */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: "cuenta",
    label: "Configuración de la cuenta",
    items: [
      { id: "datos-empresa", label: "Datos de empresa", description: "Nombre, identificación y zona horaria." },
      { id: "facturacion", label: "Facturación", description: "Tu plan, tus facturas y los datos de cobro." },
      { id: "personalizacion", label: "Personalización", description: "Marca, colores y correos del producto." },
    ],
  },
  {
    id: "equipo",
    label: "Equipo",
    items: [
      { id: "permisos", label: "Permisos", description: "Qué puede hacer cada rol dentro de la plataforma." },
      { id: "organigrama", label: "Organigrama", description: "Cómo se ordenan las áreas y quién reporta a quién." },
    ],
  },
  {
    id: "notificaciones",
    label: "Notificaciones",
    items: [{ id: "centro-notificaciones", label: "Centro de notificaciones", description: "Qué avisos se envían y a quién." }],
  },
];

export interface NotificationItem {
  title: string;
  description: string;
  date: string;
  /** Con id, la campana usa `unread` en vez de marcar las dos primeras como nuevas (datos de demo). */
  id?: string;
  unread?: boolean;
  tone?: "info" | "warning" | "negative" | "positive";
  /** Abrir lo que lo causó (la cita, la caja, el producto). */
  onSelect?: () => void;
  /** Lo que se hace desde el aviso sin abrir nada (llamar, reintentar). */
  actions?: readonly { id: string; label: string; onSelect: () => void }[];
}

export const NOTIFICATIONS: readonly NotificationItem[] = [
  { title: "Evaluaciones vencidas", description: "27 colaboradores no han completado su evaluación de desempeño.", date: "Hoy, 9:12 a.m." },
  { title: "Nuevo reporte disponible", description: "El reporte mensual de formación de junio ya está listo para descargar.", date: "Ayer, 4:30 p.m." },
  { title: "Onboarding completado", description: "12 nuevos colaboradores finalizaron su ruta de onboarding.", date: "14 jul, 11:05 a.m." },
  { title: "Licencias por renovar", description: "Tu plan renueva en 15 días. Revisa las licencias activas.", date: "12 jul, 8:00 a.m." },
  { title: "Encuesta de clima cerrada", description: "La encuesta de clima laboral Q2 cerró con 87% de participación.", date: "11 jul, 5:20 p.m." },
  { title: "Nuevo contenido asignado", description: "Se asignó la ruta \"Liderazgo ágil\" a 45 colaboradores de Ventas.", date: "10 jul, 10:15 a.m." },
  { title: "Recordatorio de 1:1", description: "Tienes 3 sesiones de feedback pendientes por agendar esta semana.", date: "9 jul, 9:00 a.m." },
  { title: "Actualización de la plataforma", description: "Nuevas funciones de reportes con IA disponibles en tu plan.", date: "8 jul, 7:45 a.m." },
];

export interface NewsItem {
  title: string;
  description: string;
  isNew?: boolean;
}

export const NEWS_ITEMS: readonly NewsItem[] = [
  { title: "Nuevo Home operativo", description: "Tu Home ahora es un centro de mando: métricas clave, quick actions y lo que necesita tu atención, todo en un solo lugar.", isNew: true },
  { title: "Agente IA de Thema", description: "Pregúntale al agente sobre pendientes, participación o evaluaciones sin salir del Home. Actívalo desde el tab \"Agente IA\" en el sidebar.", isNew: true },
  { title: "Alertas de vencimiento", description: "Recibe avisos automáticos cuando una evaluación, encuesta o assessment esté por vencer, antes de que se convierta en un pendiente oculto." },
  { title: "Modo oscuro", description: "Actívalo en Personalización, dentro del menú de la marca. Tu preferencia se mantiene en toda la plataforma." },
  { title: "Exportar reportes a Excel", description: "Los paneles de participación y evaluaciones ahora se pueden exportar directamente en formato .xlsx para compartir con liderazgo." },
];

export interface ChatHistoryItem {
  id: string;
  title: string;
  /** Sin leer (llegó respuesta y no se miró) o pensando (el agente sigue escribiendo). */
  status?: "read" | "unread" | "thinking";
}

export interface ChatHistoryGroup {
  label: string;
  items: readonly ChatHistoryItem[];
}

export const CHAT_HISTORY: readonly ChatHistoryGroup[] = [
  {
    label: "Hoy",
    items: [
      { id: "evaluaciones", title: "Evaluaciones pendientes por equipo", status: "unread" },
      { id: "participacion", title: "Participación de Ventas Bogotá" },
    ],
  },
  {
    label: "Ayer",
    items: [
      { id: "clima", title: "Resumen encuesta de clima laboral" },
      { id: "onboarding", title: "Plan de onboarding para operarios" },
    ],
  },
  {
    label: "Últimos 7 días",
    items: [
      { id: "rotacion", title: "Riesgo de rotación Q3" },
      { id: "cursos", title: "Cursos con baja satisfacción" },
      { id: "matriz", title: "Matriz de talento de liderazgo" },
    ],
  },
];

export const AGENT_SUGGESTIONS: readonly string[] = [
  "Analiza la participación en aprendizaje por equipo.",
  "Identifica colaboradores con evaluaciones vencidas.",
  "Resume los resultados de la última encuesta de clima.",
  "Detecta señales de riesgo de rotación en mi empresa.",
];

/**
 * Un rol que la persona puede asumir. No es un permiso: es la vista de la
 * plataforma que se está mirando. Quien administra necesita ver lo que ve un
 * líder o un colaborador sin cerrar sesión ni pedir una cuenta de prueba.
 */
export interface UserRoleOption {
  id: string;
  label: string;
  /** Una línea de qué cambia al asumirlo. */
  description: string;
  /**
   * Icono opcional del rol, para reconocerlo sin leer. El shell no sabe qué
   * roles existen en cada producto, así que lo trae la app con los suyos.
   */
  icon?: React.ComponentType<{ className?: string }>;
}

/** Roles de demostración; la app real inyecta los suyos vía `ShellConfig.roles`. */
export const USER_ROLES: readonly UserRoleOption[] = [
  { id: "admin", label: "Administrador", description: "Toda la empresa: productos, personas y facturación." },
  { id: "reclutador", label: "Reclutador", description: "Vacantes, candidatos y plantillas de Selección." },
  { id: "lider", label: "Líder de equipo", description: "El avance y los pendientes de su equipo." },
  { id: "colaborador", label: "Colaborador", description: "La vista de aprendizaje de cualquier persona." },
];

/** Persona de demostración; la app real inyecta la suya vía `ShellConfig.user`. */
export const CURRENT_USER = {
  name: "Carolina Vargas",
  email: "carolina.vargas@ejemplo.com",
  role: "Administrador",
  avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150&h=150",
};

/** Shared AI gradient used by the shell (segmented thumb, agent send button, ad icon). */
export const AI_GRADIENT =
  "linear-gradient(135deg, var(--color-ai-stop-1) 0%, var(--color-ai-stop-2) 38%, var(--color-ai-stop-3) 72%, var(--color-ai-stop-5) 100%)";
