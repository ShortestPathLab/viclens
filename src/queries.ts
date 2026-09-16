import { QueryClient, useQuery } from "@tanstack/react-query";
import { loadData, zoneFiles } from "./data";
import type { Lgas, School, Zones } from "./data";

// Data files are static, so a loaded file never goes stale. Failed loads are surfaced with a
// retry button rather than retried silently.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
  },
});
export const useSchoolsQuery = () =>
  useQuery({ queryKey: ["schools"], queryFn: () => loadData<School[]>("schools.json") });
export const useZonesQuery = (level: string, enabled: boolean) =>
  useQuery({
    queryKey: ["zones", level],
    enabled,
    queryFn: async (): Promise<Zones> => {
      const parts = await Promise.all(
        zoneFiles(level).map((file) => loadData<Zones>(`${file}.json`)),
      );
      return { type: "FeatureCollection", features: parts.flatMap((part) => part.features) };
    },
  });
export const useLgasQuery = (enabled: boolean) =>
  useQuery({ queryKey: ["lgas"], enabled, queryFn: () => loadData<Lgas>("lgas.json") });
