import * as React from "react";
import { ListChecks, ListFilter, MessagesSquare, Split, Monitor, PanelRightOpen, Smartphone, Tablet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useAppT } from "@/app/i18n";
import { Grain } from "@/components/atmosphere";
import { SegmentedControl } from "@/components/selection";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { ThemeModeToggle } from "@/themes/ThemeSelector";
import { BookingFlow } from "./BookingFlow";
import { DemoHints } from "./preview/DemoHints";
import { DemoSite } from "./preview/DemoSite";
import { DeviceFrame } from "./preview/DeviceFrame";
import { PortalContent, PortalSlot } from "./preview/portalSlot";
import { usePortalNode } from "./preview/usePortalNode";
import { isBookingVersion, type BookingVersion } from "./versions";

type PreviewMode = "phone" | "tablet" | "monitor" | "widget";
const MODES: readonly PreviewMode[] = ["phone", "tablet", "monitor", "widget"];
const PUBLIC_PATH = "/reservar";
/** Por debajo de esto no caben los marcos: la reserva va a pantalla completa. */
const FRAME_MIN_WIDTH = 768;

function useIsNarrow(): boolean {
  const query = `(max-width: ${FRAME_MIN_WIDTH - 1}px)`;
  const [isNarrow, setIsNarrow] = React.useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setIsNarrow(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return isNarrow;
}

/**
 * «Agendamiento online»: la reserva que ve el cliente de la barbería.
 *
 * Con `?embed=1` es la página pública, a pantalla completa (la que se abre en
 * la tablet del local o desde el enlace). Sin él, quien administra la ve
 * dentro de cada pantalla donde vive —celular, tablet, monitor o el widget de
 * su sitio— y la puede recorrer entera con los datos de la demo.
 */
export function BookingPage({ standalone = false }: { /** La reserva sola (el repo `booking-flow`): sin «Volver a la app». */ standalone?: boolean } = {}) {
  const t = useAppT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isNarrow = useIsNarrow();
  const isEmbed = params.get("embed") === "1";
  const requested = params.get("vista") as PreviewMode | null;
  const mode: PreviewMode = requested && MODES.includes(requested) ? requested : "tablet";
  const requestedVersion = params.get("version");
  const version: BookingVersion = isBookingVersion(requestedVersion) ? requestedVersion : "guided";
  // El enlace público lleva la versión elegida (la guiada es la de siempre y no la necesita).
  const publicUrl = `${window.location.origin}${PUBLIC_PATH}?embed=1${version === "guided" ? "" : `&version=${version}`}`;
  // Una sola reserva para todas las vistas: se pinta en este nodo y el nodo se muda al marco activo,
  // así al pasar de celular a tablet, a monitor o al widget sigue en el paso en que estaba.
  const flowNode = usePortalNode("h-full w-full");
  // El panel del widget se abre al entrar a esa vista: es lo que se quiere ver ahí.
  const [isWidgetOpen, setIsWidgetOpen] = React.useState(true);

  if (isEmbed) {
    return (
      <main className="h-dvh">
        {/* La página pública cuenta para el embudo; `widget=1` la marca como abierta desde el sitio. */}
        <BookingFlow version={version} onVersionChange={(next) => setParams((current) => ({ ...Object.fromEntries(current), version: next }), { replace: true })} isPhone={isNarrow} layout={isNarrow ? "compact" : "wide"} touch={isNarrow ? "default" : "lg"} surface={params.get("widget") === "1" ? "widget" : "link"} />
      </main>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success(t("booking.preview.copied"));
    } catch {
      toast(publicUrl);
    }
  };

  const versions = [
    { value: "guided", label: t("booking.version.guided"), icon: ListChecks },
    { value: "agenda-list", label: t("booking.version.agendaList"), icon: ListFilter },
    { value: "mixed", label: t("booking.version.mixed"), icon: Split },
    { value: "chat", label: t("booking.version.chat"), icon: MessagesSquare },
  ];
  const setParam = (key: string, value: string) => setParams((current) => ({ ...Object.fromEntries(current), [key]: value }), { replace: true });
  const selectMode = (value: string) => {
    if (value === "widget") setIsWidgetOpen(true);
    setParam("vista", value);
  };
  const isWidget = !isNarrow && mode === "widget";
  const flow = (
    <BookingFlow
      key={version}
      version={version}
      onVersionChange={(next) => setParam("version", next)}
      isPhone={isNarrow || mode === "phone"}
      layout={!isNarrow && mode === "monitor" ? "wide" : "compact"}
      touch={!isNarrow && mode === "tablet" ? "lg" : "default"}
      onFinish={isWidget ? () => setIsWidgetOpen(false) : undefined}
      headerTrailing={
        isWidget ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsWidgetOpen(false)} aria-label={t("booking.site.close")}>
            <ThemaIcon name="close" />
          </Button>
        ) : undefined
      }
    />
  );


  const modes = [
    { value: "phone", label: t("booking.preview.phone"), icon: Smartphone },
    { value: "tablet", label: t("booking.preview.tablet"), icon: Tablet },
    { value: "monitor", label: t("booking.preview.monitor"), icon: Monitor },
    { value: "widget", label: t("booking.preview.widget"), icon: PanelRightOpen },
  ];

  return (
    <div className="flex h-dvh flex-col bg-surface-subtle">
      <header className="relative z-header flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        {!standalone && (
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ThemaIcon name="arrowLeft" />
            <span className="hidden sm:inline">{t("booking.preview.back")}</span>
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <Text weight="semibold" truncate>
            {t("booking.preview.title")}
          </Text>
          <Badge variant="secondary">{t("booking.preview.badge")}</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DemoHints />
          <ThemeModeToggle />
          <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
            <ThemaIcon name="link" />
            <span className="hidden md:inline">{t("booking.preview.copy")}</span>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label={t("booking.preview.open")}>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ThemaIcon name="expand" />
            </a>
          </Button>
        </div>
      </header>

      <main className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
        <Grain scope="container" />
        {/* Los controles de la vista previa, centrados bajo la cabecera: la experiencia y, si hay marcos, el dispositivo. */}
        <div className="relative z-raised flex shrink-0 flex-col items-center gap-2 px-4 pb-1 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <SegmentedControl className="w-auto" options={versions} value={version} onChange={(value) => setParam("version", value)} size="sm" fullWidth={isNarrow} ariaLabel={t("booking.version.label")} />
            {!isNarrow && <SegmentedControl className="w-auto" options={modes} value={mode} onChange={selectMode} size="sm" ariaLabel={t("booking.preview.mode")} />}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-0 md:p-6 md:pt-3">
          {isNarrow ? (
            <PortalSlot node={flowNode} className="h-full w-full" />
          ) : isWidget ? (
            <DeviceFrame device="monitor" address="barberia.example.com">
              <DemoSite isOpen={isWidgetOpen} onOpenChange={setIsWidgetOpen}>
                <PortalSlot node={flowNode} className="h-full w-full" />
              </DemoSite>
            </DeviceFrame>
          ) : (
            <DeviceFrame device={mode === "widget" ? "monitor" : mode} address={publicUrl.replace(/^https?:\/\//, "")}>
              <PortalSlot node={flowNode} className="h-full w-full" />
            </DeviceFrame>
          )}
        </div>
        <PortalContent node={flowNode}>{flow}</PortalContent>
      </main>
    </div>
  );
}
