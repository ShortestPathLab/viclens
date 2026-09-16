import { useAtom, useAtomValue } from "jotai";
import { Card, CloseButton, Description, Table, Typography } from "@heroui/react";
import { formatNumber } from "../data";
import { selectedLgaAtom, showLgasAtom } from "../state/atoms";
import ContentTransition from "./ContentTransition";
import Presence from "./Presence";

// Glass already gives the card its surface, so the table drops HeroUI's tinted header and white
// body. Rows are separated by rules alone, and the outer columns line up with the card's edges.
const column = "bg-transparent px-2 after:content-none first:ps-0 last:pe-0";
const cell = "px-2 first:ps-0 last:pe-0";

export default function LgaCard() {
  const [lga, setLga] = useAtom(selectedLgaAtom);
  const showLgas = useAtomValue(showLgasAtom);
  return (
    <Presence value={showLgas && lga}>
      {(lga, transition) => (
        <Card
          {...transition}
          // Shaped, inset and animated like the explorer and detail panels rather than as a
          // default card, so the three read as one set.
          className="lga-panel glass panel-motion panel-motion--left rounded-2xl p-5"
          render={(props) => <section {...props} />}
          aria-label="Local government area details"
        >
          {/* The close button stays put while the contents change between areas. */}
          <CloseButton
            aria-label="Close LGA details"
            className="absolute top-3 right-3 z-1"
            onPress={() => setLga(null)}
          />
          <ContentTransition id={lga.code} fit contentClassName="flex flex-col gap-3">
            <Card.Header className="gap-1 pr-8">
              <Typography type="h4" className="text-balance">
                {lga.name}
              </Typography>
              <Card.Description>Local government area · February 2025</Card.Description>
            </Card.Header>
            <Card.Content>
              {lga.sectors.length ? (
                <Table variant="secondary" aria-label={`${lga.name} enrolments by sector`}>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader className={column}>
                        Sector
                      </Table.Column>
                      <Table.Column className={`${column} text-end`}>Schools</Table.Column>
                      <Table.Column className={`${column} text-end`}>FTE</Table.Column>
                    </Table.Header>
                    <Table.Body items={lga.sectors}>
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
                <Description>No matching enrolment total in the workbook.</Description>
              )}
            </Card.Content>
            <Card.Footer>
              <Description>
                Covers all sectors. School filters do not change this summary.
              </Description>
            </Card.Footer>
          </ContentTransition>
        </Card>
      )}
    </Presence>
  );
}
