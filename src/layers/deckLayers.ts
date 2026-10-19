import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import { formatNumber, levelLabel } from "../data";
import type { School } from "../data";
import type { Hover } from "../map/basemap";
import PolygonFillLayer from "../map/PolygonFillLayer";
import type { MapSurfaces, Rgb } from "../state/palette";
import { shortOf } from "./fields";
import type { AreaFeature, CategoryField, NumberField, Stop, ZoneFeature } from "./fields";
import type { SelectedArea } from "./state";
import type { ColorEncoding, LayerView } from "./useLayerViews";

type Rgba = [number, number, number, number];
const withAlpha = ([r, g, b]: Rgb, a: number): Rgba => [r, g, b, a];
const positionOf = (item: unknown) =>
  Array.isArray(item) ? ([item[0], item[1]] as [number, number]) : (item as School).position!;

export interface DrawContext {
  surfaces: MapSurfaces;
  selected: School | null;
  selectedArea: SelectedArea | null;
  setBinDomain: (id: string, domain: [number, number]) => void;
}

// Sorting decides which marks land on top. The order depends only on the items and the encoding,
// so it is worked out once per pair.
const sortCache = new WeakMap<object, WeakMap<object, unknown[]>>();
function sorted<T>(items: T[], key: object, compare: (a: T, b: T) => number): T[] {
  let byKey = sortCache.get(items);
  if (!byKey) sortCache.set(items, (byKey = new WeakMap()));
  let result = byKey.get(key) as T[] | undefined;
  if (!result) byKey.set(key, (result = [...items].sort(compare)));
  return result;
}
const valueGetter = (field: NumberField<never>, view: LayerView) => {
  const get = field.get as (item: unknown, ctx: LayerView["ctx"]) => number | null;
  return (item: unknown) => get(item, view.ctx);
};
const colorGetter = (encoding: ColorEncoding, view: LayerView) => {
  if (encoding.kind === "single") return () => encoding.color;
  const get = encoding.field.get as (item: unknown, ctx: LayerView["ctx"]) => string | null;
  return (item: unknown) => encoding.colorOf(get(item, view.ctx));
};

/** The deck.gl layers for every ready layer view, bottom of the list first. */
export function buildDeckLayers(views: LayerView[], draw: DrawContext): Layer[] {
  const layers: Layer[] = [];
  for (const view of [...views].reverse()) {
    if (view.status !== "ready" || !view.encoding) continue;
    const built = buildLayer(view, draw);
    if (built) layers.push(...built);
  }
  return layers;
}

function buildLayer(view: LayerView, draw: DrawContext): Layer[] | null {
  const { config, encoding } = view;
  const { surfaces } = draw;
  // The id carries the display: deck.gl matches layers by id, and a new display is a different
  // kind of layer that must not inherit the old one's state.
  const base = {
    id: `${config.id}:${config.display}`,
    visible: config.visible,
    opacity: config.opacity,
    pickable: true,
  };
  if (!encoding) return null;
  const points = config.dataset === "schools" || config.dataset === "stops";
  const isSchools = config.dataset === "schools";

  if (points && (encoding.kind === "single" || encoding.kind === "categories")) {
    // Missing categories go underneath, so the labelled points stay readable.
    const items =
      encoding.kind === "categories"
        ? sorted(view.items, encoding, (a, b) => {
            const get = encoding.field.get as (item: unknown, ctx: LayerView["ctx"]) => unknown;
            return Number(get(a, view.ctx) !== null) - Number(get(b, view.ctx) !== null);
          })
        : view.items;
    return [
      new ScatterplotLayer<unknown>({
        ...base,
        data: items,
        getPosition: positionOf,
        radiusUnits: "pixels",
        getRadius: config.size ?? 4,
        stroked: isSchools,
        getFillColor: colorGetter(encoding, view),
        getLineColor: surfaces.markerOutline,
        lineWidthMinPixels: isSchools ? 1 : 0,
        updateTriggers: { getFillColor: [encoding] },
      }),
    ];
  }
  if (isSchools && encoding.kind === "scale") {
    const value = valueGetter(encoding.field, view);
    // Missing values sit underneath, then low to high so the extremes stay visible.
    const items = sorted(
      view.items,
      encoding,
      (a, b) => (value(a) ?? -Infinity) - (value(b) ?? -Infinity),
    );
    return [
      new ScatterplotLayer<unknown>({
        ...base,
        data: items,
        getPosition: positionOf,
        radiusUnits: "pixels",
        getRadius: (item) =>
          value(item) === null ? Math.max(1.5, (config.size ?? 5) * 0.6) : (config.size ?? 5),
        stroked: true,
        getFillColor: (item) => {
          const v = value(item);
          return v === null ? withAlpha(surfaces.missing, 140) : encoding.scale.color(v);
        },
        getLineColor: surfaces.markerOutline,
        lineWidthMinPixels: 1,
        updateTriggers: { getFillColor: [encoding], getRadius: [encoding, config.size] },
      }),
    ];
  }
  if (isSchools && encoding.kind === "bubbles") {
    const value = valueGetter(encoding.field, view);
    const color = colorGetter(encoding.color, view);
    const items = sorted(
      view.items.filter((item) => (value(item) ?? 0) > 0),
      encoding,
      (a, b) => (value(b) ?? 0) - (value(a) ?? 0),
    );
    return [
      new ScatterplotLayer<unknown>({
        ...base,
        data: items,
        getPosition: positionOf,
        radiusUnits: "pixels",
        // Area, not radius, follows the value.
        getRadius: (item) =>
          Math.max(
            1.5,
            Math.sqrt(Math.min(1, (value(item) ?? 0) / encoding.max)) * encoding.maxRadius,
          ),
        stroked: true,
        getFillColor: (item) => withAlpha(color(item), 150),
        getLineColor: (item) => withAlpha(color(item), 235),
        lineWidthMinPixels: 1,
        updateTriggers: {
          getRadius: [encoding],
          getFillColor: [encoding],
          getLineColor: [encoding],
        },
      }),
    ];
  }
  if (points && encoding.kind === "density") {
    const value = encoding.field ? valueGetter(encoding.field, view) : null;
    const items = value ? view.items.filter((item) => value(item) !== null) : view.items;
    const weight = value ? (item: unknown) => value(item) ?? 0 : 1;
    if (config.display === "heatmap")
      return [
        new HeatmapLayer<unknown>({
          ...base,
          pickable: false,
          data: items,
          getPosition: positionOf,
          getWeight: weight,
          radiusPixels: config.size ?? 30,
          colorRange: encoding.colors,
          threshold: 0.04,
          updateTriggers: { getWeight: [encoding.field?.id] },
        }),
      ];
    return [
      new HexagonLayer<unknown>({
        ...base,
        data: items,
        getPosition: positionOf,
        radius: (config.size ?? 4) * 1000,
        coverage: 0.9,
        colorRange: encoding.colors,
        getColorWeight: weight,
        colorAggregation: value && config.aggregation === "mean" ? "MEAN" : "SUM",
        gpuAggregation: false,
        onSetColorDomain: (domain) => draw.setBinDomain(config.id, domain),
        updateTriggers: { getColorWeight: [encoding.field?.id] },
      }),
    ];
  }

  // Polygons: zones and areas.
  const isZones = config.dataset === "zones";
  const selectedId = draw.selected?.id;
  const isSelected = (feature: unknown) =>
    isZones
      ? (feature as ZoneFeature).properties.schoolId === selectedId && !!selectedId
      : draw.selectedArea?.dataset === config.dataset &&
        (feature as AreaFeature).properties.code === draw.selectedArea.code;
  const shading =
    encoding.kind === "scale"
      ? (() => {
          const value = valueGetter(encoding.field, view);
          return (feature: unknown) => {
            const v = value(feature);
            return v === null
              ? withAlpha(surfaces.missing, 60)
              : withAlpha(encoding.scale.color(v), 205);
          };
        })()
      : null;
  const outline = encoding.kind === "outline" ? encoding : null;
  const layers: Layer[] = [
    new GeoJsonLayer<unknown>({
      ...base,
      data: view.items as never,
      // Zone data shrinks as the filters narrow, which the stock fill draws wrongly. See
      // PolygonFillLayer.
      _subLayerProps: { "polygons-fill": { type: PolygonFillLayer } },
      filled: true,
      stroked: true,
      getFillColor: shading
        ? shading
        : isZones
          ? (f) => (isSelected(f) ? surfaces.zoneFillSelected : outline!.fill)
          : outline!.fill,
      getLineColor: (f) =>
        isZones && isSelected(f)
          ? surfaces.zoneLineSelected
          : shading
            ? surfaces.areaSeam
            : outline!.line,
      getLineWidth: (f) =>
        isZones && isSelected(f) ? 2 : config.dataset === "lgas" && !shading ? 1.5 : 1,
      lineWidthUnits: "pixels",
      updateTriggers: {
        getFillColor: [encoding, selectedId],
        getLineColor: [encoding, selectedId],
        getLineWidth: [selectedId, shading !== null],
      },
    }),
  ];
  // The open area gets a ring of its own above the rest, so it reads whatever the shading.
  if (!isZones && draw.selectedArea?.dataset === config.dataset) {
    const feature = (view.items as AreaFeature[]).find(isSelected);
    if (feature)
      layers.push(
        new GeoJsonLayer({
          id: `${config.id}:selected`,
          visible: config.visible,
          data: [feature],
          filled: false,
          stroked: true,
          getLineColor: withAlpha(surfaces.selectedRing, 235),
          getLineWidth: 2.5,
          lineWidthUnits: "pixels",
        }),
      );
  }
  return layers;
}

export type PickAction =
  | { kind: "school"; school: School }
  | { kind: "zone"; zone: ZoneFeature }
  | { kind: "area"; area: SelectedArea }
  | null;

const categoryText = (field: CategoryField<never>, item: unknown, view: LayerView) => {
  const value = (field.get as (item: unknown, ctx: LayerView["ctx"]) => string | null)(
    item,
    view.ctx,
  );
  return value === null ? field.missing : (field.display?.(value) ?? value);
};
const numberText = (field: NumberField<never>, item: unknown, view: LayerView) => {
  const value = valueGetter(field, view)(item);
  const name = shortOf(field, view.ctx);
  return value === null
    ? `No ${name} figure`
    : `${name.charAt(0).toUpperCase()}${name.slice(1)} ${field.format(value)}`;
};

/** What the topmost feature under the pointer is, for the hover card and for clicks. */
export function describePick(
  info: PickingInfo,
  views: LayerView[],
): { hover: Hover | null; action: PickAction } {
  const id = info.layer?.id.split(":")[0];
  const view = views.find((v) => v.config.id === id);
  if (!view || !view.encoding) return { hover: null, action: null };
  const at = (title: string, detail: string): Hover => ({ x: info.x, y: info.y, title, detail });
  const encoding = view.encoding;
  const object = info.object as unknown;
  if (view.config.display === "hexbins" && object) {
    const bin = object as { count: number; colorValue: number };
    const noun = view.dataset.noun[bin.count === 1 ? 0 : 1];
    const field = encoding.kind === "density" ? encoding.field : null;
    return {
      hover: at(
        `${formatNumber(bin.count)} ${noun}`,
        field
          ? `${view.config.aggregation === "sum" ? "Total" : "Average"} ${shortOf(field, view.ctx)}: ${field.format(bin.colorValue)}`
          : "In this hexagon",
      ),
      action: null,
    };
  }
  if (!object) return { hover: null, action: null };
  switch (view.config.dataset) {
    case "schools": {
      const school = object as School;
      const detail =
        encoding.kind === "categories"
          ? categoryText(encoding.field, school, view)
          : encoding.kind === "scale" || encoding.kind === "bubbles"
            ? numberText(encoding.field, school, view)
            : `${school.town} · ${school.sector}`;
      return { hover: at(school.name, detail), action: { kind: "school", school } };
    }
    case "stops": {
      const stop = object as Stop;
      return { hover: at(stop[3], view.ctx.modes[stop[2]] ?? "Stop"), action: null };
    }
    case "zones": {
      const zone = object as ZoneFeature;
      const parts = [`${zone.properties.year} zone`, levelLabel(zone.properties.level)];
      if (encoding.kind === "scale") parts.push(numberText(encoding.field, zone, view));
      return { hover: at(zone.properties.name, parts.join(" · ")), action: { kind: "zone", zone } };
    }
    case "lgas":
    case "sa2": {
      const area = object as AreaFeature;
      const detail =
        encoding.kind === "scale"
          ? numberText(encoding.field, area, view)
          : `${view.config.dataset === "lgas" ? "Local government area" : "SA2"} · Click for details`;
      return {
        hover: at(area.properties.name, detail),
        action: {
          kind: "area",
          area: { dataset: view.config.dataset, code: area.properties.code },
        },
      };
    }
  }
}
