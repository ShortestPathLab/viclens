import { orderBy, sumBy, uniq } from "es-toolkit";
import type { FeatureCollection, Geometry } from "geojson";

/** The ACARA School Profile row for a school, joined through the Australian Schools List. */
export interface Acara {
  id: number;
  year: number;
  icsea: number | null;
  icseaPercentile: number | null;
  /** Share of students in the bottom, lower middle, upper middle and top SEA quarters. */
  sea: [number, number, number, number] | null;
  teachingStaff: number | null;
  teachingStaffFte: number | null;
  nonTeachingStaff: number | null;
  nonTeachingStaffFte: number | null;
  enrolments: number | null;
  girls: number | null;
  boys: number | null;
  fteEnrolments: number | null;
  indigenousPct: number | null;
  lbotePct: number | null;
  remoteness: string | null;
  /** The figures cover several campuses reported as one school. */
  rolled: boolean;
}
export interface School {
  id: string;
  number: number;
  name: string;
  type: string;
  sector: string;
  position: [number, number] | null;
  town: string;
  address: string;
  postcode: string;
  region: string;
  area: string;
  lga: string;
  lgaCode: string | null;
  sa2: string | null;
  /** Full-time equivalent students in the latest February census. */
  enrolment: number | null;
  levels: Record<string, number>;
  /** Total FTE by census year, for every year the fetch could reach. */
  history: Record<string, number>;
  /** Year levels with an enrolment zone, by zone year. */
  zoneLevels: Record<string, string[]>;
  acara: Acara | null;
  fireRisk: string | null;
  transit: { stops400: number; stops800: number; nearestStop: number | null } | null;
}
/** Area measures shared by local government areas and SA2s. Missing values are null. */
export interface Metrics {
  seifaIrsdScore: number | null;
  seifaIrsdDecile: number | null;
  seifaIrsadScore: number | null;
  seifaIrsadDecile: number | null;
  seifaIerScore: number | null;
  seifaIerDecile: number | null;
  seifaIeoScore: number | null;
  seifaIeoDecile: number | null;
  population: number | null;
  age0to4: number | null;
  age5to9: number | null;
  age10to14: number | null;
  age15to19: number | null;
  age5to19Change: number | null;
  areaSqKm: number | null;
  govSchoolShare?: number | null;
  catholicSchoolShare?: number | null;
  independentSchoolShare?: number | null;
}
export interface AreaProperties {
  code: string;
  name: string;
  metrics: Metrics;
}
export interface LgaProperties extends AreaProperties {
  absCode: string | null;
  officialName: string;
  sectors: { sector: string; enrolment: number; schools: number }[];
}
export type Areas<P extends AreaProperties = AreaProperties> = FeatureCollection<Geometry, P>;
export type Lgas = Areas<LgaProperties>;
export interface ZoneProperties {
  id: string;
  schoolId: string | null;
  name: string;
  campus: string;
  level: string;
  year: number;
  entityCode: string;
}
export type Zones = FeatureCollection<Geometry, ZoneProperties>;
export interface ZoneIndex {
  years: { year: number; features: number; levels: Record<string, string[]> }[];
}
export interface Stops {
  modes: string[];
  /** Longitude, latitude, index into `modes`, stop name. */
  stops: [number, number, number, string][];
}
export interface SourceReport {
  id: string;
  title: string;
  publisher: string;
  licence: string;
  page: string;
  url: string | null;
  period: string | null;
  fetchedAt: string | null;
  sha256: string | null;
  status: "fresh" | "cached" | "missing";
  note?: string;
}
export interface Report {
  generatedAt: string;
  years: {
    locations: number;
    enrolments: number;
    enrolmentHistory: number[];
    zones: number[];
    acara: number | null;
    erp: number | null;
    erpBase: number | null;
    seifa: number | null;
    census: number | null;
    fireRisk: string | null;
  };
  sources: SourceReport[];
  matching: Record<string, unknown>;
}
export interface Filters {
  query: string;
  types: string[];
  sector: string;
  region: string;
  coverage: string;
}
export const defaultFilters: Filters = {
  query: "",
  types: [],
  sector: "All sectors",
  region: "All regions",
  coverage: "All schools",
};
export const schoolTypes = ["Primary", "Secondary", "Pri/Sec", "Special", "Language"];
export const typeNames: Record<string, string> = { "Pri/Sec": "Combined" };
export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(value);
export const options = (schools: School[], key: "region" | "sector") =>
  uniq(schools.map((s) => s[key]).filter(Boolean)).sort();
export function filterSchools(schools: School[], filters: Filters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return schools.filter(
    (s) =>
      (!query ||
        `${s.name} ${s.town} ${s.lga} ${s.number} ${s.address}`
          .toLocaleLowerCase()
          .includes(query)) &&
      (!filters.types.length || filters.types.includes(s.type)) &&
      (filters.sector === "All sectors" || s.sector === filters.sector) &&
      (filters.region === "All regions" || s.region === filters.region) &&
      (filters.coverage === "All schools" ||
        (filters.coverage === "With enrolments" ? s.enrolment !== null : s.enrolment === null)),
  );
}
export function summarise(schools: School[]) {
  return {
    total: sumBy(schools, (s) => s.enrolment ?? 0),
    matched: schools.filter((s) => s.enrolment !== null).length,
  };
}
export const sortedLevels = (levels: Record<string, number>) =>
  orderBy(
    Object.entries(levels),
    [([name]) => (name === "Prep" ? 0 : Number(name.replace("Year ", "")) || 99)],
    ["asc"],
  );
/** "Prep to Year 6", "Year 7", or "Years 7 to 9" for a standalone zone that spans several. */
export const levelLabel = (level: string) =>
  level === "P6" ? "Prep to Year 6" : `${level.includes(" to ") ? "Years" : "Year"} ${level}`;
export async function loadData<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status}).`);
  return response.json();
}
