import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { groupBy, sumBy } from "es-toolkit";
import { Card, CloseButton, Description, Separator, Table, Typography } from "@heroui/react";
import { formatNumber } from "../data";
import type { AreaProperties, School } from "../data";
import { formatPercent } from "../layers/fields";
import { openAreaAtom, selectedAreaAtom } from "../layers/state";
import type { SelectedArea } from "../layers/state";
import { useLgasQuery, useReportQuery, useSa2Query, useSchoolsQuery } from "../queries";
import ContentTransition from "./ContentTransition";
import Fact from "./Fact";
import Presence from "./Presence";

// Glass already gives the card its surface, so the table drops HeroUI's tinted header and white
// body. Rows are separated by rules alone, and the outer columns line up with the card's edges.
const column = "bg-transparent px-2 after:content-none first:ps-0 last:pe-0";
const cell = "px-2 first:ps-0 last:pe-0";
const sectorOrder = ["Government", "Catholic", "Independent"];
const decile = (value: number | null) => (value === null ? null : `${value} of 10`);

function AreaBody({
  area,
  properties,
  schools,
}: {
  area: SelectedArea;
  properties: AreaProperties;
  schools: School[];
}) {
  const { data: report } = useReportQuery();
  // Every school in the area counts here, whatever the filters, so the card describes the place.
  const sectors = useMemo(() => {
    const inside = schools.filter(
      (s) => (area.dataset === "lgas" ? s.lgaCode : s.sa2) === properties.code,
    );
    const bySector = groupBy(inside, (s) => s.sector);
    return sectorOrder
      .filter((sector) => bySector[sector])
      .map((sector) => ({
        sector,
        schools: bySector[sector].length,
        enrolment: sumBy(bySector[sector], (s) => s.enrolment ?? 0),
      }));
  }, [schools, area.dataset, properties.code]);
  const m = properties.metrics;
  const schoolAge =
    m.age5to9 != null && m.age10to14 != null && m.age15to19 != null
      ? m.age5to9 + m.age10to14 + m.age15to19
      : null;
  const change = m.age5to19Change;
  return (
    <>
      <Card.Header className="gap-1 pr-8">
        <Typography type="h4" className="text-balance">
          {properties.name}
        </Typography>
        <Card.Description>
          {area.dataset === "lgas" ? "Local government area" : "Statistical area (SA2)"}
          {report ? ` · Schools in February ${report.years.enrolments}` : ""}
        </Card.Description>
      </Card.Header>
      <Card.Content className="grid grid-cols-1 gap-4">
        {sectors.length ? (
          <Table variant="secondary">
            {/* The content is the table itself; the root is only its frame. */}
            <Table.Content aria-label={`${properties.name} schools by sector`}>
              <Table.Header>
                <Table.Column isRowHeader className={column}>
                  Sector
                </Table.Column>
                <Table.Column className={`${column} text-end`}>Schools</Table.Column>
                <Table.Column className={`${column} text-end`}>FTE</Table.Column>
              </Table.Header>
              <Table.Body items={sectors}>
                {(row) => (
                  <Table.Row id={row.sector}>
                    <Table.Cell className={cell}>{row.sector}</Table.Cell>
                    <Table.Cell className={`${cell} text-end`}>
                      {formatNumber(row.schools)}
                    </Table.Cell>
                    <Table.Cell className={`${cell} text-end`}>
                      {formatNumber(row.enrolment)}
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table>
        ) : (
          <Description>No schools are located in this area.</Description>
        )}
        <Separator variant="secondary" />
        <dl className="grid grid-cols-1 gap-2">
          <Fact
            term="Population"
            value={m.population === null ? null : formatNumber(m.population)}
          />
          <Fact
            term="Aged 5 to 19"
            value={
              schoolAge === null
                ? null
                : `${formatNumber(schoolAge)}${change === null ? "" : ` (${change > 0 ? "+" : ""}${formatNumber(change)}% in five years)`}`
            }
          />
          <Fact term="Under 5" value={m.age0to4 === null ? null : formatNumber(m.age0to4)} />
          <Fact term="Relative disadvantage (IRSD)" value={decile(m.seifaIrsdDecile)} />
          <Fact term="Economic resources (IER)" value={decile(m.seifaIerDecile)} />
          <Fact term="Education and occupation (IEO)" value={decile(m.seifaIeoDecile)} />
          {m.govSchoolShare != null && (
            <Fact term="Students at government schools" value={formatPercent(m.govSchoolShare)} />
          )}
        </dl>
      </Card.Content>
      <Card.Footer>
        <Description>
          School totals cover every sector and ignore the filters. SEIFA deciles rank areas within
          Victoria, 1 being the most disadvantaged. Population: ABS
          {report?.years.erp ? ` estimates for ${report.years.erp}` : " estimates"}.
        </Description>
      </Card.Footer>
    </>
  );
}

export default function AreaCard() {
  const area = useAtomValue(openAreaAtom);
  const setArea = useSetAtom(selectedAreaAtom);
  const { data: schools = [] } = useSchoolsQuery();
  const { data: lgas } = useLgasQuery(area?.dataset === "lgas");
  const { data: sa2 } = useSa2Query(area?.dataset === "sa2");
  const collection = area?.dataset === "lgas" ? lgas : sa2;
  const properties = collection?.features.find((f) => f.properties.code === area?.code)?.properties;
  const shown = area && properties ? { area, properties } : null;
  return (
    <Presence value={shown}>
      {({ area, properties }, transition) => (
        <Card
          {...transition}
          // Shaped, inset and animated like the explorer and detail panels rather than as a
          // default card, so the three read as one set.
          className="glass panel-motion panel-motion--left rounded-2xl p-5"
          render={(props) => <section {...props} />}
          aria-label="Area details"
        >
          {/* The close button stays put while the contents change between areas. */}
          <CloseButton
            aria-label="Close area details"
            className="absolute top-3 right-3 z-1"
            onPress={() => setArea(null)}
          />
          <ContentTransition
            id={`${area.dataset}:${area.code}`}
            fit
            contentClassName="flex flex-col gap-3"
          >
            <AreaBody area={area} properties={properties} schools={schools} />
          </ContentTransition>
        </Card>
      )}
    </Presence>
  );
}
