import { levelLabel } from "../data";
import { areaFields, labelOf, schoolFields, shortOf, stopFields, zoneFields } from "./fields";
import type { CategoryField, Field, FieldContext, NumberField } from "./fields";
import { paletteOptions } from "./palettes";
import type { PaletteId } from "./palettes";
import type { ClassMethod } from "./scales";

export type DatasetId = "schools" | "zones" | "lgas" | "sa2" | "stops";
export type DisplayId =
  | "points"
  | "graduated"
  | "bubbles"
  | "heatmap"
  | "hexbins"
  | "outline"
  | "choropleth";
export type Aggregation = "sum" | "mean";

/** One entry in the layer list. Everything a layer needs to draw itself is in here. */
export interface LayerConfig {
  id: string;
  dataset: DatasetId;
  display: DisplayId;
  visible: boolean;
  opacity: number;
  /** The number a display encodes; "count" for density and bins with no weight. */
  field?: string;
  /** The category points are coloured by; "none" for one colour. */
  colorBy?: string;
  palette?: PaletteId;
  classes?: ClassMethod;
  /** Point radius, largest bubble, heatmap radius or hexagon radius, depending on the display. */
  size?: number;
  aggregation?: Aggregation;
  zoneYear?: number;
  zoneLevel?: string;
}

export interface DisplayDef {
  id: DisplayId;
  label: string;
  description: string;
}
export const displays: Record<DisplayId, DisplayDef> = {
  points: {
    id: "points",
    label: "Points",
    description: "A dot for each one, coloured by a category",
  },
  graduated: {
    id: "graduated",
    label: "Graduated colour",
    description: "Dots shaded by a number",
  },
  bubbles: {
    id: "bubbles",
    label: "Proportional circles",
    description: "Circles sized by a number",
  },
  heatmap: {
    id: "heatmap",
    label: "Heatmap",
    description: "Where they cluster, or where a total is",
  },
  hexbins: {
    id: "hexbins",
    label: "Hexagon bins",
    description: "Counts, totals or averages on a grid",
  },
  outline: { id: "outline", label: "Boundaries", description: "Outlines with a light fill" },
  choropleth: { id: "choropleth", label: "Choropleth", description: "Areas shaded by a number" },
};

export interface DatasetDef {
  id: DatasetId;
  label: string;
  /** What a single feature is called, for counts and hover cards. */
  noun: [string, string];
  description: string;
  displays: DisplayId[];
  fields: Field<never>[];
  defaults: Omit<LayerConfig, "id" | "dataset" | "visible" | "opacity">;
}
export const datasets: Record<DatasetId, DatasetDef> = {
  schools: {
    id: "schools",
    label: "Schools",
    noun: ["school", "schools"],
    description: "Every school in the latest locations file, all sectors",
    displays: ["points", "graduated", "bubbles", "heatmap", "hexbins"],
    fields: schoolFields as Field<never>[],
    defaults: { display: "points", colorBy: "type", size: 4.5 },
  },
  zones: {
    id: "zones",
    label: "Enrolment zones",
    noun: ["zone", "zones"],
    description: "Government school zones for one year level",
    displays: ["outline", "choropleth"],
    fields: zoneFields as Field<never>[],
    defaults: { display: "outline", zoneLevel: "P6" },
  },
  lgas: {
    id: "lgas",
    label: "Local government areas",
    noun: ["area", "areas"],
    description: "Council boundaries with population, SEIFA and school totals",
    displays: ["outline", "choropleth"],
    fields: areaFields as Field<never>[],
    defaults: { display: "outline" },
  },
  sa2: {
    id: "sa2",
    label: "Statistical areas (SA2)",
    noun: ["area", "areas"],
    description: "Suburb-sized ABS areas with population, SEIFA and school totals",
    displays: ["outline", "choropleth"],
    fields: areaFields as Field<never>[],
    defaults: { display: "choropleth", field: "seifaIrsdDecile" },
  },
  stops: {
    id: "stops",
    label: "Public transport stops",
    noun: ["stop", "stops"],
    description: "Train, tram and bus stops across Victoria",
    displays: ["points", "heatmap", "hexbins"],
    fields: stopFields as Field<never>[],
    defaults: { display: "points", colorBy: "mode", size: 2.5 },
  },
};
export const datasetOrder: DatasetId[] = ["schools", "zones", "lgas", "sa2", "stops"];

// The catalogue never changes, so each dataset's lists are worked out once and stay the same
// arrays, which keeps the settings panel's memoised lookups stable.
const numberCache = new Map<DatasetId, NumberField<never>[]>();
const categoryCache = new Map<DatasetId, CategoryField<never>[]>();
export function numberFields(dataset: DatasetId) {
  let fields = numberCache.get(dataset);
  if (!fields)
    numberCache.set(
      dataset,
      (fields = datasets[dataset].fields.filter(
        (f): f is NumberField<never> => f.kind === "number",
      )),
    );
  return fields;
}
export function categoryFields(dataset: DatasetId) {
  let fields = categoryCache.get(dataset);
  if (!fields)
    categoryCache.set(
      dataset,
      (fields = datasets[dataset].fields.filter(
        (f): f is CategoryField<never> => f.kind === "category",
      )),
    );
  return fields;
}
export const findField = (dataset: DatasetId, id: string | undefined) =>
  datasets[dataset].fields.find((f) => f.id === id);

/** The controls a display shows, in order. */
export type Control =
  | "field"
  | "weight"
  | "colorBy"
  | "classes"
  | "palette"
  | "aggregation"
  | "size";
export const controls: Record<DisplayId, Control[]> = {
  points: ["colorBy", "size"],
  graduated: ["field", "classes", "palette", "size"],
  bubbles: ["field", "colorBy", "size"],
  heatmap: ["weight", "palette", "size"],
  hexbins: ["weight", "aggregation", "palette", "size"],
  outline: [],
  choropleth: ["field", "classes", "palette"],
};
export interface SizeControl {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
}
export const sizeControls: Partial<Record<DisplayId, SizeControl>> = {
  points: {
    label: "Point size",
    min: 1.5,
    max: 9,
    step: 0.5,
    value: 4.5,
    format: (v) => `${v} px`,
  },
  graduated: {
    label: "Point size",
    min: 1.5,
    max: 9,
    step: 0.5,
    value: 5,
    format: (v) => `${v} px`,
  },
  bubbles: {
    label: "Largest circle",
    min: 8,
    max: 48,
    step: 2,
    value: 24,
    format: (v) => `${v} px`,
  },
  heatmap: { label: "Radius", min: 10, max: 80, step: 5, value: 30, format: (v) => `${v} px` },
  hexbins: { label: "Hexagon size", min: 1, max: 20, step: 1, value: 4, format: (v) => `${v} km` },
};
const defaultPalette: Record<DatasetId, PaletteId> = {
  schools: "violet",
  zones: "blue",
  lgas: "teal",
  sa2: "teal",
  stops: "orange",
};

let counter = 0;
export const newLayerId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `layer-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * A layer with every option its display uses set to something valid. Stored layers from an older
 * version, a change of dataset or a change of display all pass through here, so the map never
 * sees a field that does not exist.
 */
export function normalise(input: Partial<LayerConfig> & { dataset: DatasetId }): LayerConfig {
  const dataset = datasets[input.dataset];
  const display =
    input.display && dataset.displays.includes(input.display)
      ? input.display
      : dataset.defaults.display;
  const used = controls[display];
  const numbers = numberFields(dataset.id);
  const categories = categoryFields(dataset.id);
  const config: LayerConfig = {
    id: input.id ?? newLayerId(),
    dataset: dataset.id,
    display,
    visible: input.visible ?? true,
    opacity: typeof input.opacity === "number" ? Math.min(1, Math.max(0, input.opacity)) : 1,
  };
  if (used.includes("field")) {
    const fallback =
      dataset.defaults.field ?? (dataset.id === "lgas" ? "seifaIrsdDecile" : "enrolment");
    // A circle's area reads as an amount, so circles size only by counts and totals.
    const allowed = display === "bubbles" ? numbers.filter((f) => f.additive) : numbers;
    config.field = allowed.some((f) => f.id === input.field)
      ? input.field
      : display === "bubbles"
        ? "enrolment"
        : fallback;
  }
  if (used.includes("weight"))
    config.field = numbers.some((f) => f.id === input.field) ? input.field : "count";
  if (used.includes("colorBy")) {
    const fallback = display === "bubbles" ? "none" : (dataset.defaults.colorBy ?? "none");
    config.colorBy =
      input.colorBy === "none" || categories.some((f) => f.id === input.colorBy)
        ? input.colorBy
        : fallback;
  }
  if (used.includes("classes"))
    config.classes = ["quantile", "equal", "continuous"].includes(input.classes ?? "")
      ? input.classes
      : "quantile";
  if (used.includes("palette"))
    config.palette = paletteOptions.some((p) => p.id === input.palette)
      ? input.palette
      : display === "heatmap"
        ? "orange"
        : defaultPalette[dataset.id];
  if (used.includes("aggregation")) {
    const field = numbers.find((f) => f.id === config.field);
    config.aggregation =
      input.aggregation === "sum" || input.aggregation === "mean"
        ? input.aggregation
        : field?.additive
          ? "sum"
          : "mean";
  }
  const size = sizeControls[display];
  if (size)
    config.size =
      typeof input.size === "number"
        ? Math.min(size.max, Math.max(size.min, input.size))
        : dataset.defaults.size !== undefined && display === dataset.defaults.display
          ? dataset.defaults.size
          : size.value;
  if (dataset.id === "zones") {
    config.zoneYear = typeof input.zoneYear === "number" ? input.zoneYear : undefined;
    config.zoneLevel = /^(P6|7|8|9|10|11|12)$/.test(input.zoneLevel ?? "") ? input.zoneLevel : "P6";
  }
  return config;
}
export const createLayer = (dataset: DatasetId) => normalise({ dataset });

/** The line under a layer's name, saying what it shows. */
export function describe(config: LayerConfig, ctx: FieldContext, zoneYear?: number | null): string {
  const zones = `${levelLabel(config.zoneLevel ?? "P6")}${zoneYear ? `, ${zoneYear}` : ""}`;
  const field = findField(config.dataset, config.field);
  const name = field ? shortOf(field, ctx) : "";
  const colorBy = findField(config.dataset, config.colorBy);
  switch (config.display) {
    case "points":
      return colorBy ? `Coloured by ${labelOf(colorBy, ctx).toLowerCase()}` : "One colour";
    case "graduated":
    case "choropleth":
      return config.dataset === "zones" ? `${zones}, shaded by ${name}` : `Shaded by ${name}`;
    case "bubbles":
      return `Sized by ${name}`;
    case "heatmap":
      return field
        ? `Heatmap weighted by ${name}`
        : `Heatmap of ${datasets[config.dataset].noun[1]}`;
    case "hexbins":
      return field
        ? `${config.aggregation === "sum" ? "Total" : "Average"} ${name} per hexagon`
        : `${datasets[config.dataset].label} per hexagon`;
    case "outline":
      return config.dataset === "zones" ? zones : "Boundaries";
  }
}
