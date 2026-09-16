import { useEffect, useRef } from "react";
import { Alert, Chip, Label, Meter, Separator, Typography } from "@heroui/react";
import { MapPin } from "lucide-react";
import { useAtomValue } from "jotai";
import { formatNumber, sortedLevels, typeNames } from "../data";
import type { School } from "../data";
import { cssRgb, typeColorsAtom } from "../state/palette";

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>
        <Typography type="body-sm" color="muted">
          {term}
        </Typography>
      </dt>
      <dd className="max-w-[62%]">
        <Typography type="body-sm" align="end">
          {value || "Not supplied"}
        </Typography>
      </dd>
    </div>
  );
}
export default function SchoolDetail({ school }: { school: School }) {
  const typeColors = useAtomValue(typeColorsAtom);
  const heading = useRef<HTMLHeadingElement>(null);
  // The panel mounts this afresh for each school, so a new selection moves focus to its heading.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const levels = sortedLevels(school.levels);
  const max = Math.max(...levels.map(([, value]) => value), 1);
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
      </dl>
      <Separator variant="secondary" className="my-4" />
      {school.enrolment !== null ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-tight">
                {formatNumber(school.enrolment)}
              </div>
              <Typography type="body-sm" color="muted">
                FTE students, February 2025
              </Typography>
            </div>
          </div>
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
              The supplied workbook has no February 2025 count for this school. Missing is not zero.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <Separator variant="secondary" className="my-4" />
      <Typography type="h6">2026 enrolment zones</Typography>
      <Typography type="body-sm" color="muted" className="mt-1">
        {school.zoneLevels.length
          ? `Available for ${school.zoneLevels.map((l) => (l === "P6" ? "Prep–6" : l)).join(", ")}. Pick a year level under Map layers to draw them.`
          : "No matching zone in the supplied 2026 boundaries."}
      </Typography>
    </section>
  );
}
