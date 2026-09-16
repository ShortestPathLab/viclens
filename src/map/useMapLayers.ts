import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { Feature } from "geojson";
import { formatNumber } from "../data";
import type { LgaProperties, School, ZoneProperties } from "../data";
import { useLgasQuery } from "../queries";
import {
  colorByRegionAtom,
  selectSchoolAtom,
  selectedLgaAtom,
  selectedSchoolAtom,
  showLgasAtom,
  showSchoolsAtom,
  showZonesAtom,
  sizeByEnrolmentAtom,
} from "../state/atoms";
import { useSelectZone, useVisibleSchools, useVisibleZones } from "../state/hooks";
import { mapSurfacesAtom, regionColorsAtom, typeColorsAtom } from "../state/palette";
import { cities, mapboxToken } from "./basemap";
import type { Hover } from "./basemap";
import PolygonFillLayer from "./PolygonFillLayer";

export function useMapLayers(setHover: (hover: Hover | null) => void) {
  const schools = useVisibleSchools();
  const zones = useVisibleZones();
  const selected = useAtomValue(selectedSchoolAtom);
  const showSchools = useAtomValue(showSchoolsAtom);
  const showZones = useAtomValue(showZonesAtom);
  const showLgas = useAtomValue(showLgasAtom);
  const sizeByEnrolment = useAtomValue(sizeByEnrolmentAtom);
  const colorByRegion = useAtomValue(colorByRegionAtom);
  const { data: lgas } = useLgasQuery(showLgas);
  const selectSchool = useSetAtom(selectSchoolAtom);
  const setSelectedLga = useSetAtom(selectedLgaAtom);
  const selectZone = useSelectZone();
  const colors = useAtomValue(mapSurfacesAtom);
  const typeColors = useAtomValue(typeColorsAtom);
  const regionColors = useAtomValue(regionColorsAtom);
  // Layer accessors are rebuilt only when their input data or control state changes.
  return useMemo(
    () => [
      !mapboxToken &&
        new GeoJsonLayer({
          id: "land",
          data: `${import.meta.env.BASE_URL}data/australia.geojson`,
          filled: true,
          stroked: true,
          getFillColor: colors.land,
          getLineColor: colors.landLine,
          lineWidthMinPixels: 1,
        }),
      showZones &&
        zones &&
        new GeoJsonLayer<ZoneProperties>({
          id: "school-zones",
          data: zones,
          // Zones are the one layer whose data shrinks as the filters narrow, which the stock fill
          // draws wrongly. See PolygonFillLayer.
          _subLayerProps: { "polygons-fill": { type: PolygonFillLayer } },
          pickable: true,
          filled: true,
          stroked: true,
          getFillColor: (f) =>
            f.properties.schoolId === selected?.id ? colors.zoneFillSelected : colors.zoneFill,
          getLineColor: (f) =>
            f.properties.schoolId === selected?.id ? colors.zoneLineSelected : colors.zoneLine,
          getLineWidth: (f) => (f.properties.schoolId === selected?.id ? 2 : 1),
          lineWidthUnits: "pixels",
          updateTriggers: {
            getFillColor: [selected?.id, colors],
            getLineColor: [selected?.id, colors],
            getLineWidth: [selected?.id],
          },
          onClick: (info) => {
            if (info.object) selectZone((info.object as Feature<never, ZoneProperties>).properties);
          },
          onHover: (info) =>
            setHover(
              info.object
                ? {
                    x: info.x,
                    y: info.y,
                    title: info.object.properties.name,
                    detail: `2026 zone · ${info.object.properties.level === "P6" ? "Prep–Year 6" : `Years ${info.object.properties.level}`} · ${info.object.properties.campus}`,
                  }
                : null,
            ),
        }),
      showLgas &&
        lgas &&
        new GeoJsonLayer<LgaProperties>({
          id: "local-government-areas",
          data: lgas,
          pickable: true,
          filled: true,
          stroked: true,
          getFillColor: colors.lgaFill,
          getLineColor: colors.lgaLine,
          lineWidthMinPixels: 1.5,
          onClick: (info) => {
            if (info.object) setSelectedLga(info.object.properties);
          },
          onHover: (info) =>
            setHover(
              info.object
                ? {
                    x: info.x,
                    y: info.y,
                    title: info.object.properties.name,
                    detail: "Local government area · Click for 2025 sector totals",
                  }
                : null,
            ),
        }),
      !mapboxToken &&
        new TextLayer({
          id: "cities",
          data: cities,
          getPosition: (d) => d.position as [number, number],
          getText: (d) => d.name,
          getSize: 13,
          getColor: colors.cityText,
          getPixelOffset: [0, 16],
          fontFamily: "Arial",
          fontWeight: 500,
          fontSettings: { sdf: true },
          outlineWidth: 3,
          outlineColor: colors.cityOutline,
        }),
      showSchools &&
        new ScatterplotLayer<School>({
          id: "schools",
          data: schools.filter((s) => s.position),
          pickable: true,
          stroked: true,
          getPosition: (s) => s.position!,
          radiusUnits: "pixels",
          getRadius: (s) => (sizeByEnrolment ? Math.max(3, Math.sqrt(s.enrolment ?? 0) / 4) : 4.5),
          radiusMaxPixels: 28,
          getFillColor: (s) => {
            const [r, g, b] =
              (colorByRegion ? regionColors[s.region] : typeColors[s.type]) ?? colors.fallback;
            return [r, g, b, s.enrolment === null && sizeByEnrolment ? 110 : 220] as [
              number,
              number,
              number,
              number,
            ];
          },
          getLineColor: colors.markerOutline,
          lineWidthMinPixels: 1,
          updateTriggers: {
            getRadius: [sizeByEnrolment],
            getFillColor: [colorByRegion, sizeByEnrolment, typeColors, regionColors],
          },
          onClick: (info: PickingInfo<School>) => {
            if (info.object) selectSchool(info.object);
          },
          onHover: (info: PickingInfo<School>) =>
            setHover(
              info.object
                ? {
                    x: info.x,
                    y: info.y,
                    title: info.object.name,
                    detail:
                      info.object.enrolment === null
                        ? "School-level enrolments unavailable"
                        : `${formatNumber(info.object.enrolment)} FTE students · 2025`,
                  }
                : null,
            ),
        }),
      showSchools &&
        selected?.position &&
        new ScatterplotLayer({
          id: "selected-school",
          data: [selected],
          getPosition: (s) => s.position!,
          getRadius: 15,
          radiusUnits: "pixels",
          filled: false,
          stroked: true,
          getLineColor: colors.selectedRing,
          lineWidthMinPixels: 3,
        }),
    ],
    [
      schools,
      zones,
      lgas,
      selected,
      showSchools,
      showZones,
      showLgas,
      sizeByEnrolment,
      colorByRegion,
      selectSchool,
      setSelectedLga,
      selectZone,
      setHover,
      colors,
      typeColors,
      regionColors,
    ],
  );
}
