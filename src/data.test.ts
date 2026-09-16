import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { defaultFilters, filterSchools, sortedLevels, summarise, zoneFiles } from "./data";
import type { School } from "./data";
const schools: School[] = JSON.parse(readFileSync("public/data/schools.json", "utf8"));
const report = JSON.parse(readFileSync("public/data/report.json", "utf8"));
describe("source data integrity", () => {
  it("keeps every location and matches every enrolment school", () => {
    expect(schools).toHaveLength(2301);
    expect(new Set(schools.map((s) => s.id)).size).toBe(schools.length);
    expect(report.unmatchedEnrolments).toEqual([]);
    expect(schools.filter((s) => s.enrolment !== null)).toHaveLength(1575);
    expect(schools.every((s) => s.position && s.position[0] > 140 && s.position[1] < -33)).toBe(
      true,
    );
  });
  it("sums multi-LGA school rows and reconciles every year-level breakdown", () => {
    const school = schools.find((s) => s.name === "Charles La Trobe P-12 College")!;
    expect(school.levels.Prep).toBe(28);
    expect(school.levels["Year 12"]).toBe(137.5);
    for (const s of schools.filter((s) => s.enrolment !== null))
      expect(Object.values(s.levels).reduce((a, b) => a + b, 0)).toBeCloseTo(s.enrolment!, 1);
  });
  it("does not invent private school totals", () => {
    expect(
      schools.filter((s) => s.sector !== "Government").every((s) => s.enrolment === null),
    ).toBe(true);
    expect(summarise(schools).matched).toBe(1575);
  });
});
describe("LGA data integrity", () => {
  it("matches all 79 councils to source sector totals without inventing unincorporated totals", () => {
    const lgas = JSON.parse(readFileSync("public/data/lgas.json", "utf8"));
    expect(lgas.features).toHaveLength(87);
    expect(
      lgas.features.filter(
        (f: { properties: { sectors: unknown[] } }) => f.properties.sectors.length,
      ),
    ).toHaveLength(79);
    expect(report.lgaMatchedNames).toBe(79);
  });
});
describe("school exploration", () => {
  it("searches names and postcodes, and combines filters", () => {
    expect(filterSchools(schools, { ...defaultFilters, query: "balnarring primary" })[0].name).toBe(
      "Balnarring Primary School",
    );
    expect(filterSchools(schools, { ...defaultFilters, query: "3083" }).length).toBeGreaterThan(0);
    const selected = filterSchools(schools, {
      ...defaultFilters,
      types: ["Primary"],
      sector: "Government",
      region: "North-Eastern Victoria",
    });
    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected.every(
        (s) =>
          s.type === "Primary" &&
          s.sector === "Government" &&
          s.region === "North-Eastern Victoria",
      ),
    ).toBe(true);
    expect(filterSchools(schools, { ...defaultFilters, query: "nonexistent xyzzy" })).toEqual([]);
  });
  it("keeps missing enrolments distinct from zero", () => {
    const selected = filterSchools(schools, { ...defaultFilters, coverage: "Without enrolments" });
    expect(selected.length).toBe(726);
    expect(summarise(selected)).toEqual({ total: 0, matched: 0 });
  });
  it("orders year levels numerically and selects age-appropriate standalone zones", () => {
    expect(sortedLevels({ "Year 12": 20, "Year 2": 10, Prep: 5 }).map(([level]) => level)).toEqual([
      "Prep",
      "Year 2",
      "Year 12",
    ]);
    expect(zoneFiles("7")).toContain("Standalone_juniorsec_2026");
    expect(zoneFiles("7")).not.toContain("Standalone_seniorsec_2026");
    expect(zoneFiles("12")).toContain("Standalone_seniorsec_2026");
    expect(zoneFiles("P6")).toEqual(["Primary_Integrated_2026"]);
  });
});
