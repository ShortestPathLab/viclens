import { filterSchools } from "../data";
import type { Filters, School, Zones } from "../data";

// Several components need the same filtered collections. Caching on the identity of the inputs
// keeps one result per (data, filters) pair, so deck.gl layers see stable data references and do
// not re-upload attributes on unrelated renders.
const schoolCache = new WeakMap<School[], WeakMap<Filters, School[]>>();
export function visibleSchools(schools: School[], filters: Filters): School[] {
  let byFilters = schoolCache.get(schools);
  if (!byFilters) schoolCache.set(schools, (byFilters = new WeakMap()));
  let result = byFilters.get(filters);
  if (!result) byFilters.set(filters, (result = filterSchools(schools, filters)));
  return result;
}
// Zones follow the school filters. A zone with no matching school stays visible only while no
// filter is applied, so it can still be clicked for an explanation. Every filter combination
// produces its own `visible` array, so that array alone identifies the result and `filtered`
// needs no cache key of its own.
const zoneCache = new WeakMap<Zones, WeakMap<School[], Zones>>();
export function visibleZones(zones: Zones, visible: School[], filtered: boolean): Zones {
  let byVisible = zoneCache.get(zones);
  if (!byVisible) zoneCache.set(zones, (byVisible = new WeakMap()));
  let result = byVisible.get(visible);
  if (!result) {
    const ids = new Set(visible.map((s) => s.id));
    result = {
      ...zones,
      features: zones.features.filter((f) =>
        f.properties.schoolId ? ids.has(f.properties.schoolId) : !filtered,
      ),
    };
    byVisible.set(visible, result);
  }
  return result;
}
