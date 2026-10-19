import { Button, Chip, Link, Modal, Separator, Skeleton, Typography } from "@heroui/react";
import { ArrowUpRight, Info } from "lucide-react";
import { useReportQuery } from "../queries";

const statusLabel = { cached: "Kept from an earlier fetch", missing: "Not available" } as const;
const fetched = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(iso),
      )
    : null;

// The button is the modal's own trigger, so react-aria owns the open state and focus return.
export default function AboutModal() {
  const { data: report, isLoading } = useReportQuery();
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
              <Modal.Heading>About the data</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid grid-cols-1 gap-5">
              <Typography type="body-sm" color="muted">
                Every layer is built from the public sources below by the data fetch, which records
                where each file came from and when.
              </Typography>
              {isLoading && <Skeleton className="h-24 w-full rounded-lg" />}
              {report?.sources.map((source, i) => (
                <div key={source.id} className="grid grid-cols-1 gap-1.5">
                  {i > 0 && <Separator variant="secondary" className="mb-3.5" />}
                  <div className="flex items-baseline justify-between gap-3">
                    <Typography type="h6">{source.title}</Typography>
                    {source.period && (
                      <Typography type="body-xs" color="muted" className="shrink-0">
                        {source.period}
                      </Typography>
                    )}
                  </div>
                  <Typography type="body-sm" color="muted">
                    {source.publisher} · {source.licence}
                    {source.fetchedAt && source.status !== "missing"
                      ? ` · Fetched ${fetched(source.fetchedAt)}`
                      : ""}
                  </Typography>
                  {source.status !== "fresh" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" variant="secondary">
                        {statusLabel[source.status]}
                      </Chip>
                      {source.note && (
                        <Typography type="body-xs" color="muted">
                          {source.note}
                        </Typography>
                      )}
                    </div>
                  )}
                  <Link
                    href={source.page}
                    target="_blank"
                    rel="noreferrer"
                    className="justify-self-start text-sm"
                  >
                    Source page <ArrowUpRight size={14} />
                  </Link>
                </div>
              ))}
              <Separator variant="secondary" />
              <Typography type="body-sm" color="muted">
                Zones are an exploration aid; check eligibility with the school or Find my School.
                Sources are joined on school number and sector wherever they carry them. The fire
                risk registers name facilities only, so they join on exact name and town.
                {report?.years.acara
                  ? " ACARA's School Profile figures are used under the My School terms of use."
                  : ""}
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
