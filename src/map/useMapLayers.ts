import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { buildDeckLayers } from "../layers/deckLayers";
import { binDomainsAtom, selectedAreaAtom } from "../layers/state";
import { useLayerViews } from "../layers/useLayerViews";
import { selectedSchoolAtom } from "../state/atoms";
import { mapSurfacesAtom } from "../state/palette";
import { cities, mapboxToken } from "./basemap";

/** The deck.gl layers for the map, and the layer views they were drawn from. */
export function useMapLayers() {
  const views = useLayerViews();
  const selected = useAtomValue(selectedSchoolAtom);
  const selectedArea = useAtomValue(selectedAreaAtom);
  const surfaces = useAtomValue(mapSurfacesAtom);
  const setBinDomains = useSetAtom(binDomainsAtom);
  // deck.gl reports a hexagon layer's domain while it updates, which can fall inside a render, so
  // the legend learns it a moment later. An unchanged domain leaves the state alone.
  const setBinDomain = useCallback(
    (id: string, [min, max]: [number, number]) =>
      queueMicrotask(() =>
        setBinDomains((domains) =>
          domains[id]?.[0] === min && domains[id]?.[1] === max
            ? domains
            : { ...domains, [id]: [min, max] },
        ),
      ),
    [setBinDomains],
  );
  const layers = useMemo(
    () => [
      !mapboxToken &&
        new GeoJsonLayer({
          id: "land",
          data: `${import.meta.env.BASE_URL}data/australia.geojson`,
          filled: true,
          stroked: true,
          getFillColor: surfaces.land,
          getLineColor: surfaces.landLine,
          lineWidthMinPixels: 1,
        }),
      ...buildDeckLayers(views, {
        surfaces,
        selected,
        selectedArea,
        setBinDomain,
      }),
      !mapboxToken &&
        new TextLayer({
          id: "cities",
          data: cities,
          getPosition: (d) => d.position as [number, number],
          getText: (d) => d.name,
          getSize: 13,
          getColor: surfaces.cityText,
          getPixelOffset: [0, 16],
          fontFamily: "Arial",
          fontWeight: 500,
          fontSettings: { sdf: true },
          outlineWidth: 3,
          outlineColor: surfaces.cityOutline,
        }),
      // The ring marks the open school even when no layer draws schools.
      selected?.position &&
        new ScatterplotLayer({
          id: "selected-school",
          data: [selected],
          getPosition: (s) => s.position!,
          getRadius: 15,
          radiusUnits: "pixels",
          filled: false,
          stroked: true,
          getLineColor: surfaces.selectedRing,
          lineWidthMinPixels: 3,
        }),
    ],
    [views, selected, selectedArea, surfaces, setBinDomain],
  );
  return { layers, views };
}
