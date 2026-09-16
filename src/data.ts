import { orderBy, sumBy, uniq } from "es-toolkit";
import type { FeatureCollection, Geometry } from "geojson";

export interface School {
  id: string;
  number: number;
  name: string;
  type: string;
  sector: string;
  position: [number, number] | null;
  town: string;
  address: string;
  region: string;
  area: string;
  lga: string;
  enrolment: number | null;
  levels: Record<string, number>;
  zoneLevels: string[];
}
export interface LgaProperties {
  code: string;
  name: string;
  officialName: string;
  sectors: { sector: string; enrolment: number; schools: number }[];
}
export type Lgas = FeatureCollection<Geometry, LgaProperties>;
export interface ZoneProperties {
  id: string;
  schoolId: string | null;
  name: string;
  campus: string;
  level: string;
  year: number;
}
export type Zones = FeatureCollection<Geometry, ZoneProperties>;
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
export function zoneFiles(level: string) {
  if (level === "P6") return ["Primary_Integrated_2026"];
  const year = Number(level);
  return [
    `Secondary_Integrated_Year${year}_2026`,
    "Standalone_singlesex_2026",
    ...(year <= 9 ? ["Standalone_juniorsec_2026"] : []),
    ...(year >= 11 ? ["Standalone_seniorsec_2026"] : []),
  ];
}
export async function loadData<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status}).`);
  return response.json();
}
