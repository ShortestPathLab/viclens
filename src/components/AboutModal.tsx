import { Button, Link, Modal, Separator, Typography } from "@heroui/react";
import { ArrowUpRight, Info } from "lucide-react";

const sources = [
  {
    title: "Locations",
    period: "2025",
    body: "All 2,301 schools in the DataVic CSV, across government, Catholic and independent sectors. Each marker is the supplied school location, not every campus.",
  },
  {
    title: "Enrolments",
    period: "February 2025",
    body: "School-level full-time equivalent counts from the hidden School Name raw Data sheet. All 1,575 school names matched. Rows across LGAs are summed at school level and counts can be fractional. Other sectors have no school-level enrolments in this workbook.",
  },
  {
    title: "Zones",
    period: "2026",
    body: "3,127 boundaries across primary, secondary year levels and standalone zones. 35 zone names have no exact 2025 location match; they stay visible with all filters cleared. Zones are not education regions, which are a school attribute shown by marker colour.",
  },
  {
    title: "Local government areas",
    period: "September 2026",
    body: "Vicmap Admin boundaries, simplified for display. Totals come from the hidden LGA Raw Data sheet for February 2025, cover all sectors and ignore the school filters.",
  },
];
// The button is the modal's own trigger, so react-aria owns the open state and focus return.
export default function AboutModal() {
  return (
    <Modal>
      <Button variant="ghost" size="sm">
        <Info size={14} /> About the data
      </Button>
      <Modal.Backdrop variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="glass">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>One map, four sources</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid grid-cols-1 gap-5">
              {sources.map((source, i) => (
                <div key={source.title} className="grid grid-cols-1 gap-1.5">
                  {i > 0 && <Separator variant="secondary" className="mb-3.5" />}
                  <div className="flex items-baseline justify-between gap-3">
                    <Typography type="h6">{source.title}</Typography>
                    <Typography type="body-xs" color="muted">
                      {source.period}
                    </Typography>
                  </div>
                  <Typography type="body-sm" color="muted">
                    {source.body}
                  </Typography>
                </div>
              ))}
              <Separator variant="secondary" />
              <Typography type="body-sm" color="muted">
                Boundaries are an exploration aid. Check current eligibility with the school or Find
                my School. No approximate locations, guessed name matches or private-school
                enrolments are manufactured.
              </Typography>
              <div className="grid grid-cols-1 justify-items-start gap-2">
                <Link href="https://www.findmyschool.vic.gov.au/" target="_blank" rel="noreferrer">
                  Find my School <ArrowUpRight size={14} />
                </Link>
                <Link
                  href={`${import.meta.env.BASE_URL}data/report.json`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Data matching report <ArrowUpRight size={14} />
                </Link>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
