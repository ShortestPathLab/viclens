import { useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import DeckGL from "@deck.gl/react";
import { MapView } from "@deck.gl/core";
import Map from "react-map-gl/mapbox";
import { Typography } from "@heroui/react";
import { MapPin } from "lucide-react";
import Presence, { useEnterTransition } from "../components/Presence";
import { useIsDesktop } from "../components/useMediaQuery";
import { LAYOUT, coveredLeft } from "../layout";
import { selectedLgaAtom, selectedSchoolAtom, showLgasAtom, viewAtom } from "../state/atoms";
import { withoutTransition } from "../state/camera";
import { resolvedThemeAtom } from "../state/theme";
import type { Camera } from "../state/camera";
import { mapboxToken } from "./basemap";
import type { Hover } from "./basemap";
import MapControls from "./MapControls";
import MapTooltip from "./MapTooltip";
import { useEasedPadding } from "./useEasedPadding";
import { useElementSize } from "./useElementSize";
import { useMapLayers } from "./useMapLayers";

export default function SchoolMap() {
  const [container, size] = useElementSize<HTMLElement>();
  const [view, setView] = useAtom(viewAtom);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<Hover | null>(null);
  const layers = useMapLayers(setHover);
  const isDesktop = useIsDesktop();
  const theme = useAtomValue(resolvedThemeAtom);
  const noteTransition = useEnterTransition();
  // The panels float over the map, so the viewport centre moves clear of whatever they cover:
  // right on a desktop, past the detail panel and the local government card when they are open,
  // and up on a phone where the detail rests along the bottom edge. deck.gl hands the same padding
  // to the basemap, which keeps the two cameras aligned.
  const hasDetail = useAtomValue(selectedSchoolAtom) !== null;
  const showLgas = useAtomValue(showLgasAtom);
  const selectedLga = useAtomValue(selectedLgaAtom);
  const hasLgaCard = showLgas && selectedLga !== null;
  const padding = useMemo(
    () => ({
      left: isDesktop ? coveredLeft(size.width, hasDetail, hasLgaCard) : 0,
      bottom: !isDesktop && hasDetail ? Math.round(size.height * LAYOUT.sheetHeight) : 0,
    }),
    [isDesktop, hasDetail, hasLgaCard, size.width, size.height],
  );
  const easedPadding = useEasedPadding(padding);
  const views = useMemo(
    () => new MapView({ id: "default-view", padding: easedPadding }),
    [easedPadding],
  );
  return (
    <section
      ref={container}
      className="absolute inset-0 bg-water"
      aria-label="Victorian school map"
    >
      <DeckGL
        views={views}
        viewState={view}
        onViewStateChange={(e) => {
          setView(withoutTransition(e.viewState as Camera));
          setHover(null);
        }}
        controller={{ dragRotate: false, touchRotate: false }}
        layers={layers}
        onError={(e) => setError(e.message)}
        getCursor={({ isHovering, isDragging }) =>
          isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
        }
      >
        {/* deck.gl recognises the basemap only as its own direct child. It reads `mapStyle` to
            identify the element, then clones the current viewport into it and pushes it beneath
            the deck canvas. Wrapping this in Suspense or any other element hides it from that
            check, which leaves the basemap at its default camera and painted over every data
            layer. mapbox-gl itself is still fetched on demand: react-map-gl imports it
            dynamically when the map mounts, which only happens when a token is set.

            `projection` is pinned to mercator. Mapbox styles otherwise curve into a globe below
            about zoom 6, while deck.gl only projects Web Mercator, so the two drift apart and
            the school points land in the wrong place. */}
        {mapboxToken ? (
          <Map
            mapboxAccessToken={mapboxToken}
            mapStyle={`mapbox://styles/mapbox/${theme === "dark" ? "dark" : "light"}-v11`}
            projection="mercator"
            onError={(e) => setError(e.error.message)}
          />
        ) : null}
      </DeckGL>
      <Presence value={hover}>
        {(hover, transition) => <MapTooltip hover={hover} size={size} transition={transition} />}
      </Presence>
      <MapControls size={size} padding={padding} />
      {!mapboxToken && (
        <Typography
          {...noteTransition}
          type="body-xs"
          className="glass panel-motion panel-motion--bottom absolute bottom-[calc(var(--sheet-h)+1rem)] left-4 flex items-center gap-2 rounded-lg px-3 py-2 md:bottom-4 md:left-[var(--map-inset)]"
        >
          <MapPin size={13} />
          Geographic preview. Add a Mapbox key for streets.
        </Typography>
      )}
      <Presence value={error}>
        {(error, transition) => (
          <Typography
            {...transition}
            type="body-sm"
            role="alert"
            className="glass panel-motion panel-motion--top absolute inset-x-4 top-4 z-5 rounded-xl p-4 md:right-[var(--controls-clearance)] md:left-[var(--map-inset)] md:mx-auto md:max-w-[440px]"
          >
            Map unavailable: {error}. The school list still works.
          </Typography>
        )}
      </Presence>
      {!mapboxToken && (
        <Typography type="body-xs" color="muted" className="absolute right-1 bottom-0.5">
          Natural Earth · DataVic
        </Typography>
      )}
    </section>
  );
}
