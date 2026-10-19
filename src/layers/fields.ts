import type { Feature, Geometry } from "geojson";
import { formatNumber, schoolTypes, typeNames } from "../data";
import type { AreaProperties, Metrics, Report, School, Stops, ZoneProperties } from "../data";
import {
  regionColorsByScheme,
  sectorColorsByScheme,
  transportColorsByScheme,
  typeColorsByScheme,
} from "../state/palette";
import type { Rgb } from "../state/palette";
import { rampColor } from "./palettes";
import type { PaletteId, Scheme } from "./palettes";

export type Stop = Stops["stops"][number];
export type AreaFeature = Feature<Geometry, AreaProperties>;
export type ZoneFeature = Feature<Geometry, ZoneProperties>;

/** School totals for one area, built from the schools that pass the current filters. */
export interface AreaAggregate {
  schools: number;
  enrolment: number;
  government: number;
  icseaSum: number;
  icseaWeight: number;
  acaraFte: number;
  teachingFte: number;
}
export interface FieldContext {
  scheme: Scheme;
  report: Report | undefined;
  schoolsById: Map<string, School>;
  aggregates: Map<string, AreaAggregate> | null;
  modes: string[];
}
type Label = string | ((ctx: FieldContext) => string);
interface FieldBase {
  id: string;
  label: Label;
  /** Short form for layer summaries and the legend. */
  short?: Label;
  group: string;
}
export interface NumberField<T> extends FieldBase {
  kind: "number";
  get: (item: T, ctx: FieldContext) => number | null;
  format: (value: number) => string;
  diverging?: boolean;
  discrete?: [number, number];
  /** What the two ends of a fixed range mean, for the legend. */
  ends?: [string, string];
  /** A count or total, so summing it over an area or hexagon means something. */
  additive?: boolean;
}
export interface CategoryField<T> extends FieldBase {
  kind: "category";
  get: (item: T, ctx: FieldContext) => string | null;
  /** The categories in legend order, from the values present. */
  order: (values: string[]) => string[];
  colors: (values: string[], scheme: Scheme) => Record<string, Rgb>;
  display?: (value: string) => string;
  /** Legend label for items without a value. */
  missing: string;
}
export type Field<T> = NumberField<T> | CategoryField<T>;
export const labelOf = (field: { label: Label }, ctx: FieldContext) =>
  typeof field.label === "function" ? field.label(ctx) : field.label;
export const shortOf = (field: FieldBase, ctx: FieldContext) => {
  const short = field.short ?? field.label;
  return typeof short === "function" ? short(ctx) : short;
};

export const formatPercent = (v: number) => `${formatNumber(v)}%`;
const formatChange = (v: number) => `${v > 0 ? "+" : ""}${formatNumber(v)}%`;
const formatWhole = (v: number) => formatNumber(Math.round(v));
export const formatDistance = (v: number) =>
  v >= 1000 ? `${formatNumber(Math.round(v / 100) / 10)} km` : `${Math.round(v / 10) * 10} m`;

/** The census year five years before the latest one, or the earliest year fetched after it. */
export function changeBaseYear(report: Report | undefined) {
  const latest = report?.years.enrolments;
  const years = report?.years.enrolmentHistory ?? [];
  if (!latest) return null;
  const earlier = years.filter((y) => y < latest);
  return earlier.filter((y) => y <= latest - 5).at(-1) ?? earlier[0] ?? null;
}
const share = (part: number | null | undefined, whole: number | null | undefined) =>
  part != null && whole ? (part / whole) * 100 : null;

const ordinal = (palette: PaletteId) => (values: string[], scheme: Scheme) =>
  Object.fromEntries(
    values.map((v, i) => [
      v,
      rampColor(palette, 0.35 + (0.65 * i) / Math.max(1, values.length - 1), scheme),
    ]),
  );
const fixedOrder = (known: string[]) => (values: string[]) => [
  ...known.filter((v) => values.includes(v)),
  ...values.filter((v) => !known.includes(v)).sort(),
];
const remoteness = ["Major Cities", "Inner Regional", "Outer Regional", "Remote", "Very Remote"];
// The registers number their categories from the most exposed, Category 0, down to the grassfire
// list's Category 4, so the legend runs from the least exposed to the most.
const fireSeverity = (label: string) => -(Number(/\d+/.exec(label)?.[0]) || 0);

export const schoolFields: Field<School>[] = [
  {
    kind: "category",
    id: "type",
    label: "School type",
    group: "School",
    get: (s) => s.type,
    order: fixedOrder(schoolTypes),
    colors: (_, scheme) => typeColorsByScheme[scheme],
    display: (v) => typeNames[v] ?? v,
    missing: "Unknown type",
  },
  {
    kind: "category",
    id: "sector",
    label: "Sector",
    group: "School",
    get: (s) => s.sector,
    order: fixedOrder(["Government", "Catholic", "Independent"]),
    colors: (_, scheme) => sectorColorsByScheme[scheme],
    missing: "Unknown sector",
  },
  {
    kind: "category",
    id: "region",
    label: "Education region",
    group: "School",
    get: (s) => s.region,
    order: (values) => [...values].sort(),
    colors: (_, scheme) => regionColorsByScheme[scheme],
    display: (v) => v.replace(" Victoria", ""),
    missing: "No region",
  },
  {
    kind: "category",
    id: "remoteness",
    label: "Remoteness",
    group: "School",
    get: (s) => s.acara?.remoteness ?? null,
    order: fixedOrder(remoteness),
    colors: ordinal("teal"),
    missing: "Not in the ACARA profile",
  },
  {
    kind: "category",
    id: "fireRisk",
    label: "Fire risk register",
    short: "fire risk",
    group: "School",
    get: (s) => s.fireRisk,
    order: (values) => [...values].sort((a, b) => fireSeverity(a) - fireSeverity(b)),
    colors: ordinal("orange"),
    missing: "Not listed",
  },
  {
    kind: "number",
    id: "enrolment",
    label: (ctx) => `Enrolments, February ${ctx.report?.years.enrolments ?? ""}`.trim(),
    short: "enrolments",
    group: "Enrolments",
    get: (s) => s.enrolment,
    format: (v) => `${formatNumber(v)} FTE`,
    additive: true,
  },
  {
    kind: "number",
    id: "enrolmentChange",
    label: (ctx) => `Enrolment change since ${changeBaseYear(ctx.report) ?? "the earliest year"}`,
    short: "enrolment change",
    group: "Enrolments",
    get: (s, ctx) => {
      const base = changeBaseYear(ctx.report);
      const before = base ? s.history[base] : undefined;
      // A school that started tiny makes any growth look enormous, so it has no change figure.
      return before && before >= 20 && s.enrolment !== null
        ? ((s.enrolment - before) / before) * 100
        : null;
    },
    format: formatChange,
    diverging: true,
  },
  {
    kind: "number",
    id: "icsea",
    label: "ICSEA",
    group: "Socio-educational advantage",
    get: (s) => s.acara?.icsea ?? null,
    format: formatWhole,
  },
  {
    kind: "number",
    id: "icseaPercentile",
    label: "ICSEA percentile",
    group: "Socio-educational advantage",
    get: (s) => s.acara?.icseaPercentile ?? null,
    format: formatWhole,
  },
  {
    kind: "number",
    id: "seaBottom",
    label: "Students in the bottom SEA quarter",
    short: "bottom SEA quarter",
    group: "Socio-educational advantage",
    get: (s) => s.acara?.sea?.[0] ?? null,
    format: formatPercent,
  },
  {
    kind: "number",
    id: "seaTop",
    label: "Students in the top SEA quarter",
    short: "top SEA quarter",
    group: "Socio-educational advantage",
    get: (s) => s.acara?.sea?.[3] ?? null,
    format: formatPercent,
  },
  {
    kind: "number",
    id: "studentTeacherRatio",
    label: "Students per teacher",
    short: "students per teacher",
    group: "Staff",
    get: (s) =>
      s.acara?.fteEnrolments && s.acara.teachingStaffFte && s.acara.teachingStaffFte >= 1
        ? s.acara.fteEnrolments / s.acara.teachingStaffFte
        : null,
    format: formatNumber,
  },
  {
    kind: "number",
    id: "teachingStaffFte",
    label: "Teaching staff (FTE)",
    short: "teaching staff",
    group: "Staff",
    get: (s) => s.acara?.teachingStaffFte ?? null,
    format: formatNumber,
    additive: true,
  },
  {
    kind: "number",
    id: "nonTeachingStaffFte",
    label: "Non-teaching staff (FTE)",
    short: "non-teaching staff",
    group: "Staff",
    get: (s) => s.acara?.nonTeachingStaffFte ?? null,
    format: formatNumber,
    additive: true,
  },
  {
    kind: "number",
    id: "girlsPct",
    label: "Girls",
    short: "share of girls",
    group: "Students",
    get: (s) =>
      s.acara?.girls != null && s.acara.boys != null
        ? share(s.acara.girls, s.acara.girls + s.acara.boys)
        : null,
    format: formatPercent,
  },
  {
    kind: "number",
    id: "indigenousPct",
    label: "Indigenous students",
    short: "Indigenous students",
    group: "Students",
    get: (s) => s.acara?.indigenousPct ?? null,
    format: formatPercent,
  },
  {
    kind: "number",
    id: "lbotePct",
    label: "Language background other than English",
    short: "LBOTE students",
    group: "Students",
    get: (s) => s.acara?.lbotePct ?? null,
    format: formatPercent,
  },
  {
    kind: "number",
    id: "stops800",
    label: "Public transport stops within 800 m",
    short: "stops within 800 m",
    group: "Access",
    get: (s) => s.transit?.stops800 ?? null,
    format: formatWhole,
  },
  {
    kind: "number",
    id: "nearestStop",
    label: "Distance to the nearest stop",
    short: "distance to a stop",
    group: "Access",
    get: (s) => s.transit?.nearestStop ?? null,
    format: formatDistance,
  },
];

const schoolNumberFields = schoolFields.filter(
  (f): f is NumberField<School> => f.kind === "number",
);
/** Zones take their values from the school they belong to. */
export const zoneFields: Field<ZoneFeature>[] = schoolNumberFields.map((field) => ({
  ...field,
  get: (zone: ZoneFeature, ctx: FieldContext) => {
    const school = zone.properties.schoolId
      ? ctx.schoolsById.get(zone.properties.schoolId)
      : undefined;
    return school ? field.get(school, ctx) : null;
  },
}));

const metric =
  (key: keyof Metrics) =>
  (area: AreaFeature): number | null =>
    area.properties.metrics[key] ?? null;
const schoolAge = (m: Metrics) =>
  m.age5to9 != null && m.age10to14 != null && m.age15to19 != null
    ? m.age5to9 + m.age10to14 + m.age15to19
    : null;
const aggregate = (area: AreaFeature, ctx: FieldContext) =>
  ctx.aggregates?.get(area.properties.code) ?? null;
const seifa = (
  key: keyof Metrics,
  name: string,
  short: string,
  ends: [string, string],
): NumberField<AreaFeature> => ({
  kind: "number",
  id: key,
  label: `${name}, decile`,
  short: `${short} decile`,
  group: "Socio-economic (SEIFA)",
  get: metric(key),
  format: formatWhole,
  discrete: [1, 10],
  ends,
});
const censusShare = (key: keyof Metrics, sector: string): NumberField<AreaFeature> => ({
  kind: "number",
  id: key,
  label: `Students at ${sector} schools`,
  short: `${sector} school share`,
  group: "Schooling (Census)",
  get: metric(key),
  format: formatPercent,
});

export const areaFields: Field<AreaFeature>[] = [
  seifa("seifaIrsdDecile", "Relative disadvantage (IRSD)", "IRSD", [
    "most disadvantaged",
    "least disadvantaged",
  ]),
  seifa("seifaIrsadDecile", "Advantage and disadvantage (IRSAD)", "IRSAD", [
    "most disadvantaged",
    "most advantaged",
  ]),
  seifa("seifaIerDecile", "Economic resources (IER)", "IER", [
    "fewest resources",
    "most resources",
  ]),
  seifa("seifaIeoDecile", "Education and occupation (IEO)", "IEO", ["lowest", "highest"]),
  {
    kind: "number",
    id: "population",
    label: "Population",
    short: "population",
    group: "Population",
    get: metric("population"),
    format: formatWhole,
    additive: true,
  },
  {
    kind: "number",
    id: "schoolAge",
    label: "School-age residents (5 to 19)",
    short: "school-age residents",
    group: "Population",
    get: (a) => schoolAge(a.properties.metrics),
    format: formatWhole,
    additive: true,
  },
  {
    kind: "number",
    id: "age0to4",
    label: "Children under 5",
    short: "children under 5",
    group: "Population",
    get: metric("age0to4"),
    format: formatWhole,
    additive: true,
  },
  {
    kind: "number",
    id: "age5to19Change",
    label: "School-age population change over five years",
    short: "school-age change",
    group: "Population",
    get: metric("age5to19Change"),
    format: formatChange,
    diverging: true,
  },
  {
    kind: "number",
    id: "schoolAgeDensity",
    label: "School-age residents per km²",
    short: "school-age density",
    group: "Population",
    get: (a) => {
      const count = schoolAge(a.properties.metrics);
      const area = a.properties.metrics.areaSqKm;
      return count != null && area ? count / area : null;
    },
    format: formatWhole,
  },
  censusShare("govSchoolShare", "government"),
  censusShare("catholicSchoolShare", "Catholic"),
  censusShare("independentSchoolShare", "independent"),
  {
    kind: "number",
    id: "schoolCount",
    label: "Schools",
    short: "schools",
    group: "Schools in the area",
    get: (a, ctx) => aggregate(a, ctx)?.schools ?? 0,
    format: formatWhole,
    additive: true,
  },
  {
    kind: "number",
    id: "schoolEnrolment",
    label: "School enrolments (FTE)",
    short: "enrolments",
    group: "Schools in the area",
    get: (a, ctx) => aggregate(a, ctx)?.enrolment ?? 0,
    format: (v) => `${formatWhole(v)} FTE`,
    additive: true,
  },
  {
    kind: "number",
    id: "enrolmentPerResident",
    label: "Enrolments per school-age resident",
    short: "enrolments per resident",
    group: "Schools in the area",
    get: (a, ctx) => {
      const residents = schoolAge(a.properties.metrics);
      const total = aggregate(a, ctx)?.enrolment;
      return residents && total != null ? total / residents : null;
    },
    format: (v) => formatNumber(Math.round(v * 100) / 100),
  },
  {
    kind: "number",
    id: "governmentShare",
    label: "Government share of enrolments",
    short: "government share",
    group: "Schools in the area",
    get: (a, ctx) => {
      const totals = aggregate(a, ctx);
      return totals?.enrolment ? share(totals.government, totals.enrolment) : null;
    },
    format: formatPercent,
  },
  {
    kind: "number",
    id: "meanIcsea",
    label: "Average ICSEA, weighted by enrolment",
    short: "average ICSEA",
    group: "Schools in the area",
    get: (a, ctx) => {
      const totals = aggregate(a, ctx);
      return totals?.icseaWeight ? totals.icseaSum / totals.icseaWeight : null;
    },
    format: formatWhole,
  },
  {
    kind: "number",
    id: "areaStudentTeacherRatio",
    label: "Students per teacher",
    short: "students per teacher",
    group: "Schools in the area",
    get: (a, ctx) => {
      const totals = aggregate(a, ctx);
      return totals?.teachingFte ? totals.acaraFte / totals.teachingFte : null;
    },
    format: formatNumber,
  },
];

/** Stops are grouped by vehicle: a regional and a metropolitan train are both trains. */
export const transportMode = (mode: string) =>
  /train/i.test(mode) ? "Train" : /tram/i.test(mode) ? "Tram" : "Bus";
export const stopFields: Field<Stop>[] = [
  {
    kind: "category",
    id: "mode",
    label: "Mode",
    group: "Stop",
    get: (stop, ctx) => transportMode(ctx.modes[stop[2]] ?? ""),
    order: fixedOrder(["Train", "Tram", "Bus"]),
    colors: (_, scheme) => transportColorsByScheme[scheme],
    missing: "Other",
  },
];

const areaKey = { lgas: (s: School) => s.lgaCode, sa2: (s: School) => s.sa2 };
const aggregateCache = new WeakMap<
  School[],
  Partial<Record<keyof typeof areaKey, Map<string, AreaAggregate>>>
>();
/** Totals per area for one set of schools, cached on that set so each filter change counts once. */
export function aggregateSchools(schools: School[], by: keyof typeof areaKey) {
  let cached = aggregateCache.get(schools);
  if (!cached) aggregateCache.set(schools, (cached = {}));
  const hit = cached[by];
  if (hit) return hit;
  const totals = new Map<string, AreaAggregate>();
  for (const s of schools) {
    const code = areaKey[by](s);
    if (!code) continue;
    let t = totals.get(code);
    if (!t)
      totals.set(
        code,
        (t = {
          schools: 0,
          enrolment: 0,
          government: 0,
          icseaSum: 0,
          icseaWeight: 0,
          acaraFte: 0,
          teachingFte: 0,
        }),
      );
    t.schools++;
    t.enrolment += s.enrolment ?? 0;
    if (s.sector === "Government") t.government += s.enrolment ?? 0;
    const weight = s.acara?.fteEnrolments ?? s.enrolment ?? 0;
    if (s.acara?.icsea != null && weight) {
      t.icseaSum += s.acara.icsea * weight;
      t.icseaWeight += weight;
    }
    if (s.acara?.fteEnrolments && s.acara.teachingStaffFte) {
      t.acaraFte += s.acara.fteEnrolments;
      t.teachingFte += s.acara.teachingStaffFte;
    }
  }
  cached[by] = totals;
  return totals;
}
