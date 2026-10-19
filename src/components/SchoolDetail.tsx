import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Alert, Chip, Label, Meter, Separator, Typography } from "@heroui/react";
import { Flame, MapPin } from "lucide-react";
import { useAtomValue } from "jotai";
import { formatNumber, sortedLevels, typeNames } from "../data";
import type { School } from "../data";
import { changeBaseYear, formatDistance, formatPercent } from "../layers/fields";
import { useReportQuery } from "../queries";
import { cssRgb, typeColorsAtom } from "../state/palette";
import Fact from "./Fact";

const percentile = (n: number) => {
  const rest = n % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix} percentile`;
};
/** "Prep to Year 6, Years 7 to 12" from the zone level ids a school has. */
function zoneSummary(levels: string[]) {
  const years = levels
    .filter((l) => l !== "P6")
    .map(Number)
    .sort((a, b) => a - b);
  const parts = levels.includes("P6") ? ["Prep to Year 6"] : [];
  let start = years[0];
  years.forEach((year, i) => {
    if (years[i + 1] === year + 1) return;
    parts.push(start === year ? `Year ${year}` : `Years ${start} to ${year}`);
    start = years[i + 1];
  });
  return parts.join(", ");
}
function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <>
      <Separator variant="secondary" className="my-4" />
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <Typography type="h6">{title}</Typography>
        {note && (
          <Typography type="body-xs" color="muted">
            {note}
          </Typography>
        )}
      </div>
      {children}
    </>
  );
}
const quarterNames = ["Bottom", "Lower middle", "Upper middle", "Top"];
// The quarters are an order, not categories, so they share one ink at rising strength.
const quarterInk = [0.22, 0.42, 0.62, 0.85];

export default function SchoolDetail({ school }: { school: School }) {
  const typeColors = useAtomValue(typeColorsAtom);
  const { data: report } = useReportQuery();
  const heading = useRef<HTMLHeadingElement>(null);
  // The panel mounts this afresh for each school, so a new selection moves focus to its heading.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const levels = sortedLevels(school.levels);
  const max = Math.max(...levels.map(([, value]) => value), 1);
  const base = changeBaseYear(report);
  const before = base ? school.history[base] : undefined;
  const change =
    before && before >= 20 && school.enrolment !== null
      ? ((school.enrolment - before) / before) * 100
      : null;
  const acara = school.acara;
  const ratio =
    acara?.fteEnrolments && acara.teachingStaffFte
      ? acara.fteEnrolments / acara.teachingStaffFte
      : null;
  const zoneYears = Object.entries(school.zoneLevels).filter(([, levels]) => levels.length);
  return (
    <section aria-label="School details">
      <Typography ref={heading} tabIndex={-1} type="h4" className="pr-8 text-balance">
        {school.name}
      </Typography>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Chip size="sm">
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ background: cssRgb(typeColors[school.type]) }}
          />
          {typeNames[school.type] ?? school.type}
        </Chip>
        <Chip size="sm" variant="secondary">
          {school.sector}
        </Chip>
        {school.fireRisk && (
          <Chip size="sm" color="warning" variant="soft">
            <Flame size={12} />
            {school.fireRisk}
          </Chip>
        )}
      </div>
      <Typography type="body-sm" color="muted" className="mt-3 flex gap-2">
        <MapPin size={14} className="mt-1 shrink-0" />
        {school.address}
      </Typography>
      <Separator variant="secondary" className="my-4" />
      <dl className="grid grid-cols-1 gap-2.5">
        <Fact term="Region" value={school.region} />
        <Fact term="Area" value={school.area} />
        <Fact term="Local government" value={school.lga} />
        {acara?.remoteness && <Fact term="Remoteness" value={acara.remoteness} />}
      </dl>
      <Separator variant="secondary" className="my-4" />
      {school.enrolment !== null ? (
        <>
          <div className="text-2xl font-semibold tracking-tight">
            {formatNumber(school.enrolment)}
          </div>
          <Typography type="body-sm" color="muted">
            FTE students, February {report?.years.enrolments ?? ""}
            {change !== null &&
              `. ${change >= 0 ? "Up" : "Down"} ${formatNumber(Math.abs(change))}% since ${base}.`}
          </Typography>
          {/* The panel is narrow, so the track takes the full width and its label and value
              share the line above it. */}
          <div className="mt-4 grid grid-cols-1 gap-3" aria-label="Enrolments by year level">
            {levels.map(([level, value]) => (
              <Meter
                key={level}
                className="level-row grid grid-cols-1 gap-1"
                value={value}
                maxValue={max}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Label>
                    <Typography type="body-xs" color="muted">
                      {level}
                    </Typography>
                  </Label>
                  <Meter.Output>
                    <Typography type="body-xs">{formatNumber(value)}</Typography>
                  </Meter.Output>
                </div>
                <Meter.Track>
                  <Meter.Fill />
                </Meter.Track>
              </Meter>
            ))}
          </div>
        </>
      ) : (
        <Alert>
          <Alert.Content>
            <Alert.Title>No school-level enrolments</Alert.Title>
            <Alert.Description>
              The enrolment file has no February count for this school. Missing is not zero.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {acara && (
        <Section title="Students and staff" note={`ACARA, ${acara.year}`}>
          {acara.icsea !== null && (
            <div className="mb-3">
              <div className="text-xl font-semibold tracking-tight">
                {formatNumber(acara.icsea)}
              </div>
              <Typography type="body-sm" color="muted">
                ICSEA
                {acara.icseaPercentile !== null ? `, ${percentile(acara.icseaPercentile)}` : ""}.
                The national average is 1,000.
              </Typography>
            </div>
          )}
          {acara.sea && (
            <div className="mb-3" aria-label="Students by socio-educational advantage quarter">
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
                {acara.sea.map((share, i) => (
                  <i
                    key={quarterNames[i]}
                    className="block"
                    style={{
                      flex: `${share} 0 0`,
                      background: `color-mix(in oklab, var(--foreground) ${quarterInk[i] * 100}%, transparent)`,
                    }}
                  />
                ))}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {acara.sea.map((share, i) => (
                  <div key={quarterNames[i]} className="flex items-center gap-1.5">
                    <i
                      className="block size-2 shrink-0 rounded-full"
                      style={{
                        background: `color-mix(in oklab, var(--foreground) ${quarterInk[i] * 100}%, transparent)`,
                      }}
                    />
                    <dt>
                      <Typography type="body-xs" color="muted">
                        {quarterNames[i]}
                      </Typography>
                    </dt>
                    <dd className="ms-auto">
                      <Typography type="body-xs">{formatPercent(share)}</Typography>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <dl className="grid grid-cols-1 gap-2.5">
            <Fact term="Students per teacher" value={ratio === null ? null : formatNumber(ratio)} />
            <Fact
              term="Teaching staff"
              value={
                acara.teachingStaffFte === null
                  ? null
                  : `${formatNumber(acara.teachingStaffFte)} FTE`
              }
            />
            <Fact
              term="Other staff"
              value={
                acara.nonTeachingStaffFte === null
                  ? null
                  : `${formatNumber(acara.nonTeachingStaffFte)} FTE`
              }
            />
            {acara.girls !== null && acara.boys !== null && acara.girls + acara.boys > 0 && (
              <Fact
                term="Girls and boys"
                value={`${formatNumber(acara.girls)} and ${formatNumber(acara.boys)}`}
              />
            )}
            <Fact
              term="Indigenous students"
              value={acara.indigenousPct === null ? null : formatPercent(acara.indigenousPct)}
            />
            <Fact
              term="Language other than English"
              value={acara.lbotePct === null ? null : formatPercent(acara.lbotePct)}
            />
          </dl>
          <Typography type="body-xs" color="muted" className="mt-3">
            {acara.rolled ? "Reported together with the school's other campuses. " : ""}Source:
            Australian Curriculum, Assessment and Reporting Authority (ACARA).
          </Typography>
        </Section>
      )}
      {school.transit && (
        <Section title="Public transport">
          <dl className="grid grid-cols-1 gap-2.5">
            <Fact term="Stops within 400 m" value={formatNumber(school.transit.stops400)} />
            <Fact term="Stops within 800 m" value={formatNumber(school.transit.stops800)} />
            <Fact
              term="Nearest stop"
              value={
                school.transit.nearestStop === null
                  ? null
                  : formatDistance(school.transit.nearestStop)
              }
            />
          </dl>
        </Section>
      )}
      <Section title="Enrolment zones">
        <Typography type="body-sm" color="muted">
          {zoneYears.length
            ? zoneYears.map(([year, levels]) => `${year}: ${zoneSummary(levels)}.`).join(" ")
            : "No zone in the current zone files names this school."}
        </Typography>
      </Section>
    </section>
  );
}
