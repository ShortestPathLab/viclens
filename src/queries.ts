import { QueryClient, useQuery } from "@tanstack/react-query";
import { loadData } from "./data";
import type { Areas, Lgas, Report, School, Stops, ZoneIndex, Zones } from "./data";

// Data files are static, so a loaded file never goes stale. Failed loads are surfaced with a
// retry button rather than retried silently.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
  },
});
export const useSchoolsQuery = () =>
  useQuery({ queryKey: ["schools"], queryFn: () => loadData<School[]>("schools.json") });
export const useReportQuery = () =>
  useQuery({ queryKey: ["report"], queryFn: () => loadData<Report>("report.json") });
export const useZoneIndexQuery = () =>
  useQuery({ queryKey: ["zone-index"], queryFn: () => loadData<ZoneIndex>("zones/index.json") });

/** The zone files that make up one year level in one zone year. */
export function zoneFiles(index: ZoneIndex | undefined, year: number, level: string) {
  return index?.years.find((y) => y.year === year)?.levels[level] ?? [];
}
export const zonesQueryOptions = (index: ZoneIndex | undefined, year: number, level: string) => ({
  queryKey: ["zones", year, level],
  enabled: zoneFiles(index, year, level).length > 0,
  queryFn: async (): Promise<Zones> => {
    const parts = await Promise.all(
      zoneFiles(index, year, level).map((file) => loadData<Zones>(`zones/${file}.json`)),
    );
    return { type: "FeatureCollection", features: parts.flatMap((part) => part.features) };
  },
});
export const useZonesQuery = (year: number, level: string, enabled: boolean) => {
  const { data: index } = useZoneIndexQuery();
  const options = zonesQueryOptions(index, year, level);
  return useQuery({ ...options, enabled: enabled && options.enabled });
};
export const useLgasQuery = (enabled: boolean) =>
  useQuery({ queryKey: ["lgas"], enabled, queryFn: () => loadData<Lgas>("lgas.json") });
export const useSa2Query = (enabled: boolean) =>
  useQuery({ queryKey: ["sa2"], enabled, queryFn: () => loadData<Areas>("sa2.json") });
export const useStopsQuery = (enabled: boolean) =>
  useQuery({ queryKey: ["stops"], enabled, queryFn: () => loadData<Stops>("stops.json") });
