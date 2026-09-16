import { useAtom, useAtomValue } from "jotai";
import { Card, CloseButton, Description, Table } from "@heroui/react";
import { formatNumber } from "../data";
import { selectedLgaAtom, showLgasAtom } from "../state/atoms";

export default function LgaCard() {
  const [lga, setLga] = useAtom(selectedLgaAtom);
  const showLgas = useAtomValue(showLgasAtom);
  if (!lga || !showLgas) return null;
  return (
    <Card
      className="lga-panel absolute inset-x-4 top-4 z-5 shadow-overlay md:inset-x-auto md:top-[76px] md:right-4 md:w-[300px]"
      render={(props) => <section {...props} />}
      aria-label="Local government area details"
    >
      <Card.Header className="pr-8">
        <Card.Title className="text-base">{lga.name}</Card.Title>
        <Card.Description>Local government area · February 2025</Card.Description>
        <CloseButton
          aria-label="Close LGA details"
          className="absolute top-3 right-3"
          onPress={() => setLga(null)}
        />
      </Card.Header>
      <Card.Content>
        {lga.sectors.length ? (
          <Table aria-label={`${lga.name} enrolments by sector`}>
            <Table.Content>
              <Table.Header>
                <Table.Column isRowHeader>Sector</Table.Column>
                <Table.Column>Schools</Table.Column>
                <Table.Column>FTE</Table.Column>
              </Table.Header>
              <Table.Body items={lga.sectors}>
                {(row) => (
                  <Table.Row id={row.sector}>
                    <Table.Cell>{row.sector}</Table.Cell>
                    <Table.Cell className="text-right">{formatNumber(row.schools)}</Table.Cell>
                    <Table.Cell className="text-right">{formatNumber(row.enrolment)}</Table.Cell>
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
        <Description>Covers all sectors. School filters do not change this summary.</Description>
      </Card.Footer>
    </Card>
  );
}
