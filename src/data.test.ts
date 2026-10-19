import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { defaultFilters, filterSchools, sortedLevels, summarise } from "./data";
import type { Lgas, Report, School, ZoneIndex } from "./data";
import { aggregateSchools, changeBaseYear, transportMode } from "./layers/fields";
import { datasetOrder, datasets, normalise } from "./layers/model";
import { oklch, rampColor } from "./layers/palettes";
import { buildScale } from "./layers/scales";

// The data is built locally by `npm run data`, so these checks run only once it exists.
const built = existsSync("public/data/schools.json") && existsSync("public/data/report.json");
const read = <T>(file: string): T => JSON.parse(readFileSync(`public/data/${file}`, "utf8"));
const schools: School[] = built ? read("schools.json") : [];
const report: Report | null = built ? read("report.json") : null;

describe.skipIf(!built)("built data", () => {
  it("keeps every school once, inside Victoria", () => {
    expect(schools.length).toBe(report!.matching.schools);
    expect(schools.length).toBeGreaterThan(2000);
    expect(new Set(schools.map((s) => s.id)).size).toBe(schools.length);
    for (const s of schools.filter((s) => s.position)) {
      expect(s.position![0]).toBeGreaterThan(140);
      expect(s.position![1]).toBeLessThan(-33);
    }
  });
  it("sums year levels to each school's enrolment and keeps missing apart from zero", () => {
    for (const s of schools.filter((s) => s.enrolment !== null))
      expect(Object.values(s.levels).reduce((a, b) => a + b, 0)).toBeCloseTo(s.enrolment!, 0);
    expect(summarise(schools.filter((s) => s.enrolment === null))).toEqual({
      total: 0,
      matched: 0,
    });
  });
  it("covers all three sectors with enrolments", () => {
    for (const sector of ["Government", "Catholic", "Independent"])
      expect(schools.some((s) => s.sector === sector && s.enrolment !== null)).toBe(true);
  });
  it("records a status for every source", () => {
    expect(report!.sources.length).toBeGreaterThanOrEqual(8);
    for (const source of report!.sources)
      expect(["fresh", "cached", "missing"]).toContain(source.status);
  });
  it("indexes zone files that exist, with every year level", () => {
    const index = read<ZoneIndex>("zones/index.json");
    for (const year of index.years) {
      expect(Object.keys(year.levels).sort()).toEqual(
        ["10", "11", "12", "7", "8", "9", "P6"].sort(),
      );
      for (const file of Object.values(year.levels).flat())
        expect(existsSync(`public/data/zones/${file}.json`)).toBe(true);
    }
  });
  it("gives local government areas their sector totals from the schools inside them", () => {
    const lgas = read<Lgas>("lgas.json");
    expect(lgas.features.length).toBeGreaterThanOrEqual(79);
    const totals = aggregateSchools(schools, "lgas");
    for (const feature of lgas.features) {
      const sum = feature.properties.sectors.reduce((a, s) => a + s.schools, 0);
      expect(sum).toBe(totals.get(feature.properties.code)?.schools ?? 0);
    }
  });
});

describe("school exploration", () => {
  const sample: School[] = [
    ["Balnarring Primary School", "Primary", "Government", "3926", 320],
    ["St Mary's College", "Secondary", "Catholic", "3000", 900],
    ["Hillside Grammar", "Pri/Sec", "Independent", "3083", null],
  ].map(([name, type, sector, postcode, enrolment], i) => ({
    id: `${sector}-${i}`,
    number: i,
    name: name as string,
    type: type as string,
    sector: sector as string,
    position: [145, -37.8],
    town: "Town",
    address: `1 Road, Town ${postcode}`,
    postcode: postcode as string,
    region: "North-Eastern Victoria",
    area: "Area",
    lga: "Somewhere",
    lgaCode: "1",
    sa2: "201011001",
    enrolment: enrolment as number | null,
    levels: {},
    history: {},
    zoneLevels: {},
    acara: null,
    fireRisk: null,
    transit: null,
  }));
  it("searches names and postcodes, and combines filters", () => {
    expect(filterSchools(sample, { ...defaultFilters, query: "balnarring" })[0].name).toBe(
      "Balnarring Primary School",
    );
    expect(filterSchools(sample, { ...defaultFilters, query: "3083" })).toHaveLength(1);
    expect(
      filterSchools(sample, { ...defaultFilters, types: ["Primary"], sector: "Government" }),
    ).toHaveLength(1);
    expect(filterSchools(sample, { ...defaultFilters, query: "nonexistent xyzzy" })).toEqual([]);
  });
  it("keeps missing enrolments distinct from zero", () => {
    const missing = filterSchools(sample, { ...defaultFilters, coverage: "Without enrolments" });
    expect(missing.map((s) => s.name)).toEqual(["Hillside Grammar"]);
    expect(summarise(sample)).toEqual({ total: 1220, matched: 2 });
  });
  it("orders year levels numerically", () => {
    expect(sortedLevels({ "Year 12": 20, "Year 2": 10, Prep: 5 }).map(([level]) => level)).toEqual([
      "Prep",
      "Year 2",
      "Year 12",
    ]);
  });
  it("totals schools per area", () => {
    const totals = aggregateSchools(sample, "sa2").get("201011001")!;
    expect(totals.schools).toBe(3);
    expect(totals.enrolment).toBe(1220);
    expect(totals.government).toBe(320);
  });
});

describe("colour scales", () => {
  it("splits values into quantile classes", () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const scale = buildScale(values, { method: "quantile", palette: "teal", scheme: "light" })!;
    expect(scale.classes).toHaveLength(5);
    expect(scale.color(0)).toEqual(scale.classes[0].color);
    expect(scale.color(99)).toEqual(scale.classes[4].color);
  });
  it("gives each decile its own step", () => {
    const scale = buildScale([1, 5, 10], {
      method: "quantile",
      palette: "teal",
      scheme: "light",
      discrete: [1, 10],
    })!;
    expect(scale.classes).toHaveLength(10);
  });
  it("centres a diverging scale on zero", () => {
    const scale = buildScale([-30, -5, 0, 5, 10], {
      method: "equal",
      palette: "violet",
      scheme: "light",
      diverging: true,
    })!;
    expect(scale.min).toBe(-scale.max);
    expect(scale.color(-1)).not.toEqual(scale.color(1));
  });
  it("returns nothing for no values", () => {
    expect(buildScale([], { method: "equal", palette: "teal", scheme: "light" })).toBeNull();
  });
  it("runs light to deep in light mode and the other way in dark", () => {
    const lightness = ([r, g, b]: number[]) => r * 0.2126 + g * 0.7152 + b * 0.0722;
    expect(lightness(rampColor("blue", 0, "light"))).toBeGreaterThan(
      lightness(rampColor("blue", 1, "light")),
    );
    expect(lightness(rampColor("blue", 0, "dark"))).toBeLessThan(
      lightness(rampColor("blue", 1, "dark")),
    );
    expect(oklch(1, 0, 0)).toEqual([255, 255, 255]);
  });
});

describe("layer model", () => {
  it("fills every option a display uses and drops what does not exist", () => {
    const layer = normalise({ dataset: "schools", display: "graduated", field: "nope" });
    expect(layer.field).toBe("enrolment");
    expect(layer.palette).toBeDefined();
    expect(layer.classes).toBe("quantile");
    expect(normalise({ dataset: "zones", display: "hexbins" as never }).display).toBe("outline");
    expect(normalise({ dataset: "schools", opacity: 4 }).opacity).toBe(1);
  });
  it("gives every dataset a default that its own displays include", () => {
    for (const id of datasetOrder)
      expect(datasets[id].displays).toContain(normalise({ dataset: id }).display);
  });
  it("sizes circles only by counts and totals", () => {
    expect(normalise({ dataset: "schools", display: "bubbles", field: "icsea" }).field).toBe(
      "enrolment",
    );
    expect(
      normalise({ dataset: "schools", display: "bubbles", field: "teachingStaffFte" }).field,
    ).toBe("teachingStaffFte");
  });
  it("chooses a total for counts and an average for rates in hexagon bins", () => {
    expect(
      normalise({ dataset: "schools", display: "hexbins", field: "enrolment" }).aggregation,
    ).toBe("sum");
    expect(normalise({ dataset: "schools", display: "hexbins", field: "icsea" }).aggregation).toBe(
      "mean",
    );
  });
  it("groups transport modes by vehicle", () => {
    expect(transportMode("REGIONAL TRAIN")).toBe("Train");
    expect(transportMode("Metro Tram")).toBe("Tram");
    expect(transportMode("Regional Coach")).toBe("Bus");
  });
  it("compares enrolments with the census five years earlier", () => {
    const years = { enrolments: 2026, enrolmentHistory: [2014, 2021, 2022, 2026] };
    expect(changeBaseYear({ years } as unknown as Report)).toBe(2021);
  });
});
