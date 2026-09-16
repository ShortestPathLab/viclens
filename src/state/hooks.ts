import { useCallback, useDeferredValue } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { School, ZoneProperties, Zones } from "../data";
import { useSchoolsQuery, useZonesQuery } from "../queries";
import {
  filtersAtom,
  isFilteredAtom,
  noticeAtom,
  selectSchoolAtom,
  showZonesAtom,
  zoneLevelAtom,
} from "./atoms";
import { visibleSchools, visibleZones } from "./derive";

const noSchools: School[] = [];

// Filtering runs over every school, so the list lags a keystroke behind the text field rather
// than blocking it.
export function useVisibleSchools(): School[] {
  const { data = noSchools } = useSchoolsQuery();
  const filters = useDeferredValue(useAtomValue(filtersAtom));
  return visibleSchools(data, filters);
}
export function useVisibleZones(): Zones | null {
  const { data } = useZonesQuery(useAtomValue(zoneLevelAtom), useAtomValue(showZonesAtom));
  const filtered = useAtomValue(isFilteredAtom);
  const visible = useVisibleSchools();
  return data ? visibleZones(data, visible, filtered) : null;
}
export function useSelectZone() {
  const { data: schools = noSchools } = useSchoolsQuery();
  const selectSchool = useSetAtom(selectSchoolAtom);
  const setNotice = useSetAtom(noticeAtom);
  return useCallback(
    (zone: ZoneProperties) => {
      const school = schools.find((s) => s.id === zone.schoolId);
      if (school) selectSchool(school);
      else
        setNotice(
          `${zone.name} · ${zone.campus}. This 2026 zone has no exact match in the 2025 school locations. Enrolment and school coordinates are unavailable.`,
        );
    },
    [schools, selectSchool, setNotice],
  );
}
