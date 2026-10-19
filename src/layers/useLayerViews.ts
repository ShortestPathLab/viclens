import { createContext, createElement, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import type { School, ZoneIndex, Zones } from "../data";
import {
  useLgasQuery,
  useReportQuery,
  useSa2Query,
  useSchoolsQuery,
  useStopsQuery,
  useZoneIndexQuery,
  zonesQueryOptions,
} from "../queries";
import { isFilteredAtom } from "../state/atoms";
import { visibleZones } from "../state/derive";
import { useVisibleSchools } from "../state/hooks";
import { mapSurfacesAtom } from "../state/palette";
import type { MapSurfaces, Rgb } from "../state/palette";
import { resolvedThemeAtom } from "../state/theme";
import { aggregateSchools, labelOf, shortOf } from "./fields";
import type { CategoryField, FieldContext, NumberField } from "./fields";
import { datasets, describe, findField } from "./model";
import type { DatasetDef, LayerConfig } from "./model";
import { rampSteps } from "./palettes";
import { buildScale } from "./scales";
import type { Scale } from "./scales";
import { binDomainsAtom, layersAtom } from "./state";

type Rgba = [number, number, number, number];
export interface LegendEntry {
  value: string | null;
  label: string;
  color: Rgb;
}
export type ColorEncoding =
  | { kind: "single"; color: Rgb }
  | {
      kind: "categories";
      field: CategoryField<never>;
      title: string;
      entries: LegendEntry[];
      colorOf: (value: string | null) => Rgb;
    };
export type Encoding =
  | ColorEncoding
  | { kind: "scale"; field: NumberField<never>; title: string; scale: Scale; hasMissing: boolean }
  | {
      kind: "bubbles";
      field: NumberField<never>;
      title: string;
      /** The value that gets the largest circle. Bigger values are capped at it. */
      max: number;
      maxRadius: number;
      color: ColorEncoding;
    }
  | {
      kind: "density";
      field: NumberField<never> | null;
      title: string;
      colors: Rgb[];
      domain: [number, number] | null;
    }
  | { kind: "outline"; line: Rgba; fill: Rgba };

export interface LayerView {
  config: LayerConfig;
  dataset: DatasetDef;
  title: string;
  subtitle: string;
  status: "idle" | "loading" | "error" | "ready";
  retry: () => void;
  /** What the layer draws: schools with a position, zone or area features, or stops. */
  items: unknown[];
  encoding: Encoding | null;
  ctx: FieldContext;
  zoneYear: number | null;
}

/** The zone year a layer shows: its own choice, else this calendar year, else the nearest. */
export function zoneYearFor(config: LayerConfig, index: ZoneIndex | undefined) {
  const years = index?.years.map((y) => y.year) ?? [];
  if (!years.length) return null;
  if (config.zoneYear && years.includes(config.zoneYear)) return config.zoneYear;
  const now = new Date().getFullYear();
  return years.includes(now) ? now : (years.filter((y) => y <= now).at(-1) ?? years[0]);
}

function outlineFor(dataset: DatasetDef["id"], surfaces: MapSurfaces): Encoding {
  if (dataset === "zones")
    return { kind: "outline", line: surfaces.zoneLine, fill: surfaces.zoneFill };
  if (dataset === "sa2") return { kind: "outline", line: surfaces.sa2Line, fill: surfaces.sa2Fill };
  return { kind: "outline", line: surfaces.lgaLine, fill: surfaces.lgaFill };
}
function categoriesFor(
  field: CategoryField<never>,
  items: unknown[],
  ctx: FieldContext,
  missingColor: Rgb,
): ColorEncoding {
  const get = field.get as (item: unknown, ctx: FieldContext) => string | null;
  const present = new Set<string>();
  let hasMissing = false;
  for (const item of items) {
    const value = get(item, ctx);
    if (value === null) hasMissing = true;
    else present.add(value);
  }
  const order = field.order([...present]);
  const colors = field.colors(order, ctx.scheme);
  const entries: LegendEntry[] = order.map((value) => ({
    value,
    label: field.display?.(value) ?? value,
    color: colors[value] ?? missingColor,
  }));
  if (hasMissing) entries.push({ value: null, label: field.missing, color: missingColor });
  return {
    kind: "categories",
    field,
    title: labelOf(field, ctx),
    entries,
    colorOf: (value) => (value === null ? missingColor : (colors[value] ?? missingColor)),
  };
}
function valuesOf(field: NumberField<never>, items: unknown[], ctx: FieldContext) {
  const get = field.get as (item: unknown, ctx: FieldContext) => number | null;
  const values: number[] = [];
  let hasMissing = false;
  for (const item of items) {
    const value = get(item, ctx);
    if (value === null || !Number.isFinite(value)) hasMissing = true;
    else values.push(value);
  }
  return { values, hasMissing };
}

function encode(
  config: LayerConfig,
  items: unknown[],
  ctx: FieldContext,
  surfaces: MapSurfaces,
  binDomain: [number, number] | null,
): Encoding | null {
  const field = findField(config.dataset, config.field);
  const number = field?.kind === "number" ? field : null;
  const colorBy = findField(config.dataset, config.colorBy);
  const single: ColorEncoding = { kind: "single", color: surfaces.single };
  const colorEncoding =
    colorBy?.kind === "category" ? categoriesFor(colorBy, items, ctx, surfaces.missing) : single;
  switch (config.display) {
    case "outline":
      return outlineFor(config.dataset, surfaces);
    case "points":
      return colorEncoding;
    case "graduated":
    case "choropleth": {
      if (!number) return null;
      const { values, hasMissing } = valuesOf(number, items, ctx);
      const scale = buildScale(values, {
        method: config.classes ?? "quantile",
        palette: config.palette ?? "violet",
        scheme: ctx.scheme,
        diverging: number.diverging,
        discrete: number.discrete,
        floor: config.display === "graduated" ? 0.22 : 0,
      });
      return scale
        ? { kind: "scale", field: number, title: labelOf(number, ctx), scale, hasMissing }
        : null;
    }
    case "bubbles": {
      if (!number) return null;
      const { values } = valuesOf(number, items, ctx);
      const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
      const max = sorted[Math.floor((sorted.length - 1) * 0.99)] ?? 1;
      return {
        kind: "bubbles",
        field: number,
        title: labelOf(number, ctx),
        max,
        maxRadius: config.size ?? 24,
        color: colorEncoding,
      };
    }
    case "heatmap":
    case "hexbins":
      return {
        kind: "density",
        field: number,
        title: !number
          ? config.display === "hexbins"
            ? `${capitalise(datasets[config.dataset].noun[1])} per hexagon`
            : `Density of ${datasets[config.dataset].noun[1]}`
          : config.display === "hexbins"
            ? `${config.aggregation === "sum" ? "Total" : "Average"} ${shortOf(number, ctx)} per hexagon`
            : `Weighted by ${shortOf(number, ctx)}`,
        colors: rampSteps(config.palette ?? "orange", 6, ctx.scheme, 0.12, 1),
        domain: binDomain,
      };
  }
}

// Encodings depend on the items, the context and the options that change how a layer draws, but
// not on its visibility or opacity. Caching on those lets an opacity slider move without
// rebuilding every scale on each step.
const encodingCache = new WeakMap<
  object,
  Map<string, { deps: unknown[]; encoding: Encoding | null }>
>();
function cachedEncode(
  config: LayerConfig,
  items: unknown[],
  ctx: FieldContext,
  surfaces: MapSurfaces,
  binDomain: [number, number] | null,
) {
  const { id: _id, visible: _visible, opacity: _opacity, ...options } = config;
  const key = `${JSON.stringify(options)}|${ctx.scheme}|${binDomain?.join(",") ?? ""}`;
  const deps = [ctx.report, ctx.aggregates, ctx.schoolsById, ctx.modes, surfaces];
  let byKey = encodingCache.get(items);
  if (!byKey) encodingCache.set(items, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit && hit.deps.every((dep, i) => dep === deps[i])) return hit.encoding;
  const encoding = encode(config, items, ctx, surfaces, binDomain);
  byKey.set(key, { deps, encoding });
  return encoding;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface Source<T> {
  status: LayerView["status"];
  data: T | undefined;
  retry: () => void;
}
interface QueryLike<T> {
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
}
const sourceOf = <T>({ data, isError, isFetching, refetch }: QueryLike<T>): Source<T> => ({
  data,
  status: isError ? "error" : data ? "ready" : isFetching ? "loading" : "idle",
  retry: () => void refetch(),
});
/**
 * A query's result as a value that changes only when the query does. TanStack hands back a fresh
 * result object on every render, which would rebuild every layer's scale each time.
 */
function useSource<T>(query: QueryLike<T>): Source<T> {
  const { data, isError, isFetching, refetch } = query;
  return useMemo(
    () => sourceOf({ data, isError, isFetching, refetch }),
    [data, isError, isFetching, refetch],
  );
}
// A module-level combine lets useQueries keep the same array while no zone query changes.
const zoneSources = (results: QueryLike<Zones>[]) => results.map(sourceOf);

const noSchools: School[] = [];
/** Every layer in the list, with its data, its state and how it encodes values. */
function useComputedViews(): LayerView[] {
  const layers = useAtomValue(layersAtom);
  const scheme = useAtomValue(resolvedThemeAtom);
  const surfaces = useAtomValue(mapSurfacesAtom);
  const filtered = useAtomValue(isFilteredAtom);
  const binDomains = useAtomValue(binDomainsAtom);
  const schoolsSource = useSource(useSchoolsQuery());
  const allSchools = schoolsSource.data ?? noSchools;
  const schools = useVisibleSchools();
  const { data: report } = useReportQuery();
  const zoneIndexSource = useSource(useZoneIndexQuery());
  const zoneIndex = zoneIndexSource.data;
  const wants = (dataset: DatasetDef["id"]) =>
    layers.some((layer) => layer.dataset === dataset && layer.visible);
  const lgas = useSource(useLgasQuery(wants("lgas")));
  const sa2 = useSource(useSa2Query(wants("sa2")));
  const stops = useSource(useStopsQuery(wants("stops")));
  // Each zone layer loads its own year and level; two layers on the same pair share one request.
  const zoneKeys = useMemo(() => {
    const keys = new Map<string, { year: number; level: string; visible: boolean }>();
    for (const layer of layers) {
      if (layer.dataset !== "zones") continue;
      const year = zoneYearFor(layer, zoneIndex);
      if (year === null) continue;
      const level = layer.zoneLevel ?? "P6";
      const key = `${year}:${level}`;
      keys.set(key, { year, level, visible: layer.visible || !!keys.get(key)?.visible });
    }
    return [...keys.entries()];
  }, [layers, zoneIndex]);
  const zones = useQueries({
    queries: zoneKeys.map(([, { year, level, visible }]) => {
      const options = zonesQueryOptions(zoneIndex, year, level);
      return { ...options, enabled: visible && options.enabled };
    }),
    combine: zoneSources,
  });
  const schoolsById = useMemo(() => new Map(allSchools.map((s) => [s.id, s])), [allSchools]);
  const located = useMemo(() => schools.filter((s) => s.position), [schools]);

  return useMemo(() => {
    const zoneByKey = new Map(zoneKeys.map(([key], i) => [key, zones[i]]));
    return layers.map((config): LayerView => {
      const dataset = datasets[config.dataset];
      const ctx: FieldContext = {
        scheme,
        report,
        schoolsById,
        aggregates:
          config.dataset === "lgas" || config.dataset === "sa2"
            ? aggregateSchools(schools, config.dataset)
            : null,
        modes: stops.data?.modes ?? [],
      };
      let source: Source<unknown> = zoneIndexSource;
      let items: unknown[] = [];
      let zoneYear: number | null = null;
      switch (config.dataset) {
        case "schools":
          source = schoolsSource;
          items = located;
          break;
        case "zones": {
          zoneYear = zoneYearFor(config, zoneIndex);
          const zoneSource = zoneByKey.get(`${zoneYear}:${config.zoneLevel ?? "P6"}`);
          if (zoneSource) {
            source = zoneSource;
            items = zoneSource.data
              ? visibleZones(zoneSource.data, schools, filtered).features
              : [];
          }
          break;
        }
        case "lgas":
          source = lgas;
          items = lgas.data?.features ?? [];
          break;
        case "sa2":
          source = sa2;
          items = sa2.data?.features ?? [];
          break;
        case "stops":
          source = stops;
          items = stops.data?.stops ?? [];
          break;
      }
      return {
        config,
        dataset,
        title: dataset.label,
        subtitle: describe(config, ctx, zoneYear),
        status: source.status,
        retry: source.retry,
        items,
        encoding:
          source.status === "ready"
            ? cachedEncode(config, items, ctx, surfaces, binDomains[config.id] ?? null)
            : null,
        ctx,
        zoneYear,
      };
    });
  }, [
    layers,
    scheme,
    surfaces,
    report,
    schoolsById,
    schools,
    located,
    filtered,
    binDomains,
    zoneKeys,
    zones,
    zoneIndex,
    zoneIndexSource,
    schoolsSource,
    lgas,
    sa2,
    stops,
  ]);
}

const LayerViewsContext = createContext<LayerView[]>([]);
/**
 * Works out the layer views once for the whole app. The map, the legend and the layer list all
 * read the same views, so they can never disagree about a scale or a category colour.
 */
export function LayerViewsProvider({ children }: { children: ReactNode }) {
  return createElement(LayerViewsContext, { value: useComputedViews() }, children);
}
export const useLayerViews = () => useContext(LayerViewsContext);
