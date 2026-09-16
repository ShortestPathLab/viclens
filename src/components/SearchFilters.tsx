import { useAtomValue, useSetAtom } from "jotai";
import {
  Button,
  Description,
  Label,
  SearchField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { options, schoolTypes, typeNames } from "../data";
import { useSchoolsQuery } from "../queries";
import { filtersAtom, isFilteredAtom, resetFiltersAtom, updateFiltersAtom } from "../state/atoms";
import { cssRgb, typeColorsAtom } from "../state/palette";
import SelectField from "./SelectField";

export default function SearchFilters() {
  const { data: schools = [] } = useSchoolsQuery();
  const filters = useAtomValue(filtersAtom);
  const filtered = useAtomValue(isFilteredAtom);
  const update = useSetAtom(updateFiltersAtom);
  const reset = useSetAtom(resetFiltersAtom);
  const typeColors = useAtomValue(typeColorsAtom);
  return (
    <div className="grid grid-cols-1 gap-4">
      <SearchField
        fullWidth
        variant="secondary"
        aria-label="Search schools"
        value={filters.query}
        onChange={(query) => update({ query })}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="School, town or postcode" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <div className="grid grid-cols-1 gap-2">
        <Label id="school-type-label">School type</Label>
        <ToggleButtonGroup
          isDetached
          size="sm"
          className="w-full flex-wrap justify-start gap-1.5"
          aria-labelledby="school-type-label"
          selectionMode="multiple"
          selectedKeys={filters.types}
          onSelectionChange={(keys) => update({ types: [...keys].map(String) })}
        >
          {schoolTypes.map((type) => (
            <ToggleButton key={type} id={type}>
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: cssRgb(typeColors[type]) }}
              />
              {typeNames[type] ?? type}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <SelectField
        label="Sector"
        value={filters.sector}
        values={["All sectors", ...options(schools, "sector")]}
        onChange={(sector) => update({ sector })}
      />
      <SelectField
        label="Education region"
        value={filters.region}
        values={["All regions", ...options(schools, "region")]}
        onChange={(region) => update({ region })}
      />
      <SelectField
        label="Enrolment data"
        value={filters.coverage}
        values={["All schools", "With enrolments", "Without enrolments"]}
        onChange={(coverage) => update({ coverage })}
      >
        <Description>February 2025 counts cover government schools only.</Description>
      </SelectField>
      {filtered && (
        <Button size="sm" variant="secondary" className="w-full" onPress={reset}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
