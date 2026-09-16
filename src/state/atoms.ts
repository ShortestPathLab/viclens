import { atom } from "jotai";
import { isEqual } from "es-toolkit";
import { defaultFilters } from "../data";
import type { Filters, LgaProperties, School } from "../data";
import { flyTo, initialCamera } from "./camera";
import type { Camera } from "./camera";

export const PAGE_SIZE = 30;
export const filtersAtom = atom<Filters>(defaultFilters);
export const isFilteredAtom = atom((get) => !isEqual(get(filtersAtom), defaultFilters));
export const selectedSchoolAtom = atom<School | null>(null);
export const selectedLgaAtom = atom<LgaProperties | null>(null);
export const resultLimitAtom = atom(PAGE_SIZE);
export const showSchoolsAtom = atom(true);
export const showZonesAtom = atom(true);
export const showLgasAtom = atom(false);
export const sizeByEnrolmentAtom = atom(false);
export const colorByRegionAtom = atom(false);
export const zoneLevelAtom = atom("P6");
export const viewAtom = atom<Camera>(initialCamera);
export const noticeAtom = atom("");
export const mobileOpenAtom = atom(false);
export const panelTabAtom = atom<"schools" | "layers">("schools");

// Changing a filter invalidates the current selection and the result paging.
export const updateFiltersAtom = atom(null, (get, set, patch: Partial<Filters>) => {
  set(filtersAtom, { ...get(filtersAtom), ...patch });
  set(selectedSchoolAtom, null);
  set(resultLimitAtom, PAGE_SIZE);
});
export const resetFiltersAtom = atom(null, (_get, set) => {
  set(filtersAtom, defaultFilters);
  set(selectedSchoolAtom, null);
  set(resultLimitAtom, PAGE_SIZE);
});
// Selecting a school moves the camera. Sharing the camera as state lets the list, the map and
// the zone layer agree without passing a synthetic focus token between them.
export const selectSchoolAtom = atom(null, (_get, set, school: School) => {
  set(selectedSchoolAtom, school);
  set(noticeAtom, "");
  // The detail opens in its own panel, so on a phone the filters drawer gets out of its way.
  set(mobileOpenAtom, false);
  set(panelTabAtom, "schools");
  const position = school.position;
  if (position)
    set(viewAtom, (view) =>
      flyTo({ ...view, longitude: position[0], latitude: position[1], zoom: 12 }),
    );
});
