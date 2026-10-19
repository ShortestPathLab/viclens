import { useCallback, useDeferredValue } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { School, ZoneProperties } from "../data";
import { useSchoolsQuery } from "../queries";
import { filtersAtom, noticeAtom, selectSchoolAtom } from "./atoms";
import { visibleSchools } from "./derive";

const noSchools: School[] = [];

// Filtering runs over every school, so the list lags a keystroke behind the text field rather
// than blocking it.
export function useVisibleSchools(): School[] {
  const { data = noSchools } = useSchoolsQuery();
  const filters = useDeferredValue(useAtomValue(filtersAtom));
  return visibleSchools(data, filters);
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
          `${zone.name} · ${zone.campus}. This ${zone.year} zone matches no school in the current locations file, so it has no enrolments or school position.`,
        );
    },
    [schools, selectSchool, setNotice],
  );
}
