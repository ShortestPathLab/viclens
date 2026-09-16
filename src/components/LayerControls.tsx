import { useAtom } from "jotai";
import { Alert, Button, Description, Separator, Spinner, Typography } from "@heroui/react";
import { useLgasQuery, useZonesQuery } from "../queries";
import {
  colorByRegionAtom,
  selectedLgaAtom,
  showLgasAtom,
  showSchoolsAtom,
  showZonesAtom,
  sizeByEnrolmentAtom,
  zoneLevelAtom,
} from "../state/atoms";
import SelectField from "./SelectField";
import Toggle from "./Toggle";

const zoneLevels = [
  { id: "P6", label: "Prep – Year 6" },
  ...[7, 8, 9, 10, 11, 12].map((year) => ({ id: String(year), label: `Year ${year}` })),
];
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-2" aria-label={label}>
      <Typography type="h6">{label}</Typography>
      {children}
    </section>
  );
}
export default function LayerControls() {
  const [showSchools, setShowSchools] = useAtom(showSchoolsAtom);
  const [showZones, setShowZones] = useAtom(showZonesAtom);
  const [showLgas, setShowLgas] = useAtom(showLgasAtom);
  const [sizeByEnrolment, setSizeByEnrolment] = useAtom(sizeByEnrolmentAtom);
  const [colorByRegion, setColorByRegion] = useAtom(colorByRegionAtom);
  const [zoneLevel, setZoneLevel] = useAtom(zoneLevelAtom);
  const [selectedLga, setSelectedLga] = useAtom(selectedLgaAtom);
  const zones = useZonesQuery(zoneLevel, showZones);
  const lgas = useLgasQuery(showLgas);
  const lgaOptions = lgas.data
    ? [...new Map(lgas.data.features.map((f) => [f.properties.code, f.properties])).values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((lga) => ({ id: lga.code, label: lga.name }))
    : [];
  return (
    <div className="grid grid-cols-1 gap-5">
      <Group label="School locations">
        <Toggle label="Show schools" selected={showSchools} onChange={setShowSchools} />
        <Toggle
          label="Size by enrolment"
          selected={sizeByEnrolment}
          onChange={setSizeByEnrolment}
        />
        <Toggle label="Colour by region" selected={colorByRegion} onChange={setColorByRegion} />
      </Group>
      <Separator variant="secondary" />
      <Group label="Enrolment zones">
        <Toggle label="Show 2026 zones" selected={showZones} onChange={setShowZones} />
        {showZones && (
          <SelectField
            label="Year level"
            value={zoneLevel}
            onChange={setZoneLevel}
            values={zoneLevels}
          />
        )}
        {zones.isLoading && (
          <Typography type="body-sm" color="muted" className="flex items-center gap-2">
            <Spinner size="sm" /> Loading boundaries
          </Typography>
        )}
        {zones.isError && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>Zones did not load</Alert.Title>
              <Alert.Description>The boundary files could not be fetched.</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="ghost" onPress={() => zones.refetch()}>
              Retry
            </Button>
          </Alert>
        )}
      </Group>
      <Separator variant="secondary" />
      <Group label="Local government areas">
        <Toggle label="Show boundaries" selected={showLgas} onChange={setShowLgas} />
        {showLgas && lgas.isLoading && (
          <Typography type="body-sm" color="muted" className="flex items-center gap-2">
            <Spinner size="sm" /> Loading boundaries
          </Typography>
        )}
        {showLgas && lgas.isError && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Title>Boundaries did not load</Alert.Title>
              <Alert.Description>The LGA file could not be fetched.</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="ghost" onPress={() => lgas.refetch()}>
              Retry
            </Button>
          </Alert>
        )}
        {showLgas && lgas.data && (
          <SelectField
            label="Inspect an LGA"
            placeholder="Choose an area"
            value={selectedLga?.code ?? ""}
            onChange={(code) =>
              setSelectedLga(
                lgas.data.features.find((f) => f.properties.code === code)?.properties ?? null,
              )
            }
            values={lgaOptions}
          >
            <Description>School markers take priority over boundary clicks.</Description>
          </SelectField>
        )}
      </Group>
    </div>
  );
}
