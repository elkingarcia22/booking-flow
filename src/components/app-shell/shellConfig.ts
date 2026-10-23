import type { ShellHelpAction } from "./HelpMenu";
import * as React from "react";
import type { GlobalSearchProps } from "@/components/search";
import type { ShellMode } from "./shellTypes";
import {
  AGENT_SUGGESTIONS,
  CHAT_HISTORY,
  COMPANIES,
  COMPANY_MENU_LINKS,
  CURRENT_USER,
  NAV_TREE,
  NEWS_ITEMS,
  NOTIFICATIONS,
  SETTINGS_GROUPS,
  USER_ROLES,
  type ChatHistoryGroup,
  type Company,
  type NavEntry,
  type NewsItem,
  type NotificationItem,
  type SettingsGroup,
  type UserRoleOption,
} from "./appShellData";
import type { ShellBrandLogo } from "./brandLogo";

/**
 * Todo lo que el shell muestra y que en una aplicación real viene del
 * backend o del router: la persona conectada, el árbol de navegación, las
 * notificaciones, las empresas y los callbacks. Los valores por defecto son
 * los datos de demostración de `appShellData.ts`, así los ejemplos de la
 * documentación siguen funcionando sin configurar nada.
 */
export interface ShellUser {
  id?: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface ShellBrand {
  /** Nombre de la empresa o del producto: va al lado del isologo y es su texto alternativo. */
  productName: string;
  /** Línea bajo el nombre («Barbería», «Sistema de diseño · v0.1»). */
  tagline?: string;
  /** Isologo que subió la empresa. Sin él, la flecha de Barberlytics. Ver Fundamentos → Marca. */
  logo?: ShellBrandLogo | null;
  /**
   * `isologo` (cuadro + nombre + línea) es el formato del producto;
   * `wordmark` (logotipo Barberlytics grande + línea) el de la portada de la
   * doc. Con un logo de empresa siempre es `isologo`. Por defecto `wordmark`.
   */
  display?: "isologo" | "wordmark";
  /** Adónde llevan «Términos» y «Política de privacidad» del pie. Sin ellos son texto sin enlace. */
  termsHref?: string;
  privacyHref?: string;
}

/**
 * Los rótulos del espacio activo. `entity` encabeza el chip de la cabecera
 * ("Sucursal"), `change` es la acción y `list` el título de la lista.
 */
export interface ShellWorkspaceLabels {
  entity: string;
  change: string;
  list: string;
}

export const DEFAULT_WORKSPACE_LABELS: ShellWorkspaceLabels = {
  entity: "Empresa",
  change: "Cambiar de empresa",
  list: "Tus empresas",
};

/**
 * Piezas del shell que una vista puede apagar.
 *
 * No toda pantalla que usa este shell es la aplicación: la documentación, por
 * ejemplo, monta el mismo sidebar y la misma cabecera pero no tiene empresas
 * que cambiar, ni agente, ni novedades, ni sesión. En lugar de bifurcar el
 * shell o tapar botones con CSS, cada consumidor declara qué cromo necesita.
 * Todo viene encendido: apagar es la excepción.
 */
export interface ShellChrome {
  /** Identidad del espacio activo en la cabecera (empresa, sucursal…). */
  company: boolean;
  /** Menú de configuración de la cabecera. */
  settings: boolean;
  /** Rol activo en la cabecera, con su cambio. */
  role: boolean;
  /** Conmutador Workspace / Agente IA. */
  modeSwitch: boolean;
  /** Botón y popover de "Novedades". */
  news: boolean;
  /** Botón de ayuda. */
  help: boolean;
  /** Campana de notificaciones. */
  notifications: boolean;
  /** Avatar con el menú de perfil (incluye el cambio de modo y cerrar sesión). */
  profile: boolean;
  /** Búsqueda general de la cabecera (⌘K). */
  search: boolean;
  /** Centro de procesos: lo que sigue trabajando en segundo plano. */
  processes: boolean;
}

export const DEFAULT_SHELL_CHROME: ShellChrome = {
  company: true,
  settings: true,
  role: true,
  modeSwitch: true,
  news: true,
  help: true,
  notifications: true,
  profile: true,
  search: true,
  processes: true,
};

export interface ShellPromo {
  title: string;
  description: string;
  cta: string;
  onClick?: () => void;
}

/** Los tres anchos del sistema, más el lienzo completo. */
export type ShellContentWidth = "narrow" | "normal" | "wide" | "full";

export interface ShellConfig {
  user: ShellUser;
  brand: ShellBrand;
  navigation: readonly NavEntry[];
  /** Id del nodo activo (raíz, hijo u hoja). Sin él, el sidebar gestiona su propio estado. */
  activeNavId?: string;
  /** Se llama con el id del nodo y su `path` cuando la persona elige un ítem de navegación. */
  onNavigate?: (id: string, path?: string) => void;
  notifications: readonly NotificationItem[];
  /** Con él, el pie de la campana marca todo como leído en vez de prometer una lista que no existe. */
  onMarkAllNotificationsRead?: () => void;
  news: readonly NewsItem[];
  /**
   * Roles que la persona puede asumir desde el menú de perfil. Vacío, el menú
   * no muestra el cambio de rol y la insignia se queda con `user.role`.
   */
  roles: readonly UserRoleOption[];
  /** Rol activo. Sin él, el menú arranca en el primero y gestiona su estado. */
  activeRoleId?: string;
  /** Se llama con el id del rol elegido; la app decide qué recarga. */
  onSelectRole?: (id: string) => void;
  /**
   * Qué hace el botón «Ayuda» de la cabecera. La app abre con él el panel de
   * ayuda contextual de la pantalla actual; sin esto el botón no hace nada,
   * así que quien lo enciende en `chrome.help` tiene que darle destino.
   */
  onOpenHelp?: () => void;
  /**
   * Qué hace «Enviar feedback» en el menú lateral. La app abre con él su
   * diálogo de feedback, que sabe a dónde enviar; sin esto el shell abre el
   * mismo diálogo por su cuenta, pero sin destino.
   */
  onOpenFeedback?: () => void;
  /** Abre el historial de procesos. Sin esto el Centro de procesos no ofrece «Historial». */
  onOpenProcessHistory?: () => void;
  /**
   * Las puertas del botón «Ayuda». Con ellas el botón abre un menú (preguntar,
   * ir al centro de ayuda, que te guíen…) en vez de ejecutar `onOpenHelp`.
   */
  helpActions?: readonly ShellHelpAction[];
  companies: readonly Company[];
  /** Espacio activo. Sin él, el shell arranca en el primero y lo gestiona. */
  activeCompanyId?: string;
  /** Se llama con el id del espacio elegido; la app decide qué recarga. */
  onSelectCompany?: (id: string) => void;
  companyMenuLinks: readonly string[];
  /**
   * Cómo llama este producto al espacio activo. El shell pinta el mismo
   * conmutador para una empresa, una sucursal o una sede; lo que cambia es
   * cómo se lee.
   */
  workspaceLabels: ShellWorkspaceLabels;
  /**
   * Consumo (licencias y créditos) dentro del menú del espacio activo. Un
   * producto que no vende licencias lo apaga y el menú se queda en identidad
   * y cambio.
   */
  showWorkspaceUsage: boolean;
  /**
   * Los ajustes de la plataforma, agrupados. Salen del menú de la cabecera
   * (no del árbol de navegación) y cada ítem navega por `onNavigate`.
   */
  settings: readonly SettingsGroup[];
  /** El pie del menú de ajustes: la pantalla que los reúne todos. */
  settingsAll?: { label: string; id: string; path?: string };
  /**
   * Controles que la app añade al menú de la marca —tema, idioma—, entre la
   * identidad y los grupos de ajustes. El shell no conoce el sistema de temas
   * ni de idiomas del producto; cada consumidor los inyecta aquí.
   */
  workspaceMenuExtra?: React.ReactNode;
  chatHistory: readonly ChatHistoryGroup[];
  /** La conversación abierta en el historial; `null` es una nueva. */
  activeChatId?: string | null;
  onSelectChat?: (id: string) => void;
  onNewChat?: () => void;
  /** Borrar una conversación desde el historial; sin esto no hay botón. */
  onRemoveChat?: (id: string) => void;
  /**
   * Qué enseña la barra lateral en modo «Agente IA»: el historial de chats
   * (por defecto) o la navegación de siempre, cuando la vista del agente
   * (`agentView`) ya trae su propio historial.
   */
  agentSidebar?: "history" | "navigation";
  agentSuggestions: readonly string[];
  /**
   * Lo que se enseña en modo «Agente IA» en vez del contenido. Sin esto va
   * la portada de demostración (`AgentView`); la app pone aquí su chat.
   */
  agentView?: React.ReactNode;
  /**
   * El modo del shell, controlado desde fuera. Sin `mode` el shell lo
   * guarda él; `onModeChange` avisa igual en los dos casos.
   */
  mode?: ShellMode;
  onModeChange?: (mode: ShellMode) => void;
  /**
   * Tarjeta promocional del sidebar (modo Workspace). Apagada por defecto:
   * no sale sola, solo cuando una pantalla la pide a propósito pasando el
   * objeto. `null` es el valor por defecto y también la forma explícita de
   * apagarla.
   */
  promo: ShellPromo | null;
  /** Ítem "Cerrar sesión" del menú de perfil; sin él, el ítem no se muestra. */
  onLogout?: () => void;
  /** Envío de un prompt en el panel del agente. */
  onAgentPrompt?: (prompt: string) => void;
  /**
   * Modo claro/oscuro de la aplicación. El shell ya no ofrece el conmutador
   * —vive en «Personalización», junto al tema y el idioma, porque es de la
   * plataforma y no de la cuenta—, así que estos dos solo existen para que
   * una app que los pasaba siga compilando: quien manda sobre la clase
   * `dark` es el ThemeProvider.
   *
   * @deprecated Usa el ThemeProvider (`useTheme().setMode`).
   */
  isDark?: boolean;
  /** @deprecated Usa el ThemeProvider (`useTheme().setMode`). */
  onToggleDark?: (isDark: boolean) => void;
  /** Controles extra a la izquierda de las notificaciones (p. ej. el selector de tema). */
  headerActions?: React.ReactNode;
  /** Qué piezas del shell se muestran; por defecto, todas. */
  chrome: ShellChrome;
  /**
   * Ancho máximo de la columna de contenido, con los tres anchos del sistema
   * (ver Fundamentos › Espaciado): `narrow` 720px para formularios y
   * asistentes, `normal` 1140px para la mayoría de las pantallas y `wide`
   * 1600px para tableros densos. `full` deja que el contenido ocupe todo el
   * ancho disponible, para editores y lienzos.
   *
   * Lo pone el marco una sola vez: una pantalla no vuelve a fijar su ancho.
   */
  contentWidth: ShellContentWidth;
  /**
   * Índice de la búsqueda general. Lo que no se diga lo rellena el shell:
   * los registros de demostración, los destinos derivados de `navigation` y
   * una pregunta al agente que abre su panel.
   */
  search?: Partial<GlobalSearchProps>;
}

/** `chrome` se puede sobreescribir a medias: lo que no se diga sigue encendido. */
export type ShellConfigOverrides = Partial<Omit<ShellConfig, "chrome">> & { chrome?: Partial<ShellChrome> };

export const DEFAULT_SHELL_CONFIG: ShellConfig = {
  user: CURRENT_USER,
  brand: { productName: "Thema", tagline: "Sistema de diseño" },
  navigation: NAV_TREE,
  notifications: NOTIFICATIONS,
  news: NEWS_ITEMS,
  roles: USER_ROLES,
  companies: COMPANIES,
  companyMenuLinks: COMPANY_MENU_LINKS,
  workspaceLabels: DEFAULT_WORKSPACE_LABELS,
  showWorkspaceUsage: true,
  settings: SETTINGS_GROUPS,
  chatHistory: CHAT_HISTORY,
  agentSuggestions: AGENT_SUGGESTIONS,
  // Apagada por defecto: la tarjeta del sidebar es opt-in, no algo que
  // aparece solo. Una pantalla la enciende pasando `config.promo`.
  promo: null,
  chrome: DEFAULT_SHELL_CHROME,
  contentWidth: "normal",
};

export const ShellConfigContext = React.createContext<ShellConfig>(DEFAULT_SHELL_CONFIG);

export function useShellConfig(): ShellConfig {
  return React.useContext(ShellConfigContext);
}

export function resolveShellConfig(overrides?: ShellConfigOverrides): ShellConfig {
  if (!overrides) return DEFAULT_SHELL_CONFIG;
  return {
    ...DEFAULT_SHELL_CONFIG,
    ...overrides,
    // `chrome` se fusiona en profundidad: apagar una pieza no debe apagar el resto.
    chrome: { ...DEFAULT_SHELL_CHROME, ...overrides.chrome },
  };
}

/** Iniciales para el avatar cuando no hay imagen: "Carolina Vargas" → "CV". */
export function userInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
