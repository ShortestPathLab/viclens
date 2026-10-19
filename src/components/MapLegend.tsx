import { Typography } from "@heroui/react";
import { useAtomValue } from "jotai";
import { formatNumber } from "../data";
import { cssColor } from "../layers/palettes";
import { useLayerViews } from "../layers/useLayerViews";
import type { Encoding, LayerView } from "../layers/useLayerViews";
import { mapSurfacesAtom } from "../state/palette";
import type { Rgb } from "../state/palette";
import { useEnterTransition } from "./Presence";

const gradient = (colors: Rgb[]) =>
  `linear-gradient(90deg, ${colors.map((c) => cssColor(c)).join(", ")})`;
// The terms for ACARA's School Profile ask for its name wherever its figures appear.
const acaraFields = new Set([
  "icsea",
  "icseaPercentile",
  "seaBottom",
  "seaTop",
  "studentTeacherRatio",
  "teachingStaffFte",
  "nonTeachingStaffFte",
  "girlsPct",
  "indigenousPct",
  "lbotePct",
  "remoteness",
  "meanIcsea",
  "areaStudentTeacherRatio",
]);

function Swatch({ color, round = true }: { color: Rgb; round?: boolean }) {
  return (
    <i
      className={`block size-2 shrink-0 ${round ? "rounded-full" : "rounded-sm"}`}
      style={{ background: cssColor(color) }}
    />
  );
}
function Ends({ left, right, middle }: { left: string; right: string; middle?: string }) {
  return (
    <div className="mt-1 flex justify-between gap-2">
      <span>{left}</span>
      {middle && <span>{middle}</span>}
      <span>{right}</span>
    </div>
  );
}
function Key({ encoding, view, missing }: { encoding: Encoding; view: LayerView; missing: Rgb }) {
  switch (encoding.kind) {
    case "single":
      return (
        <span className="flex items-center gap-1.5">
          <Swatch color={encoding.color} /> Each {view.dataset.noun[0]}
        </span>
      );
    case "categories":
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {encoding.entries.map((entry) => (
            <span key={entry.label} className="flex items-center gap-1.5">
              <Swatch color={entry.color} round={view.config.display !== "choropleth"} />
              {entry.label}
            </span>
          ))}
        </div>
      );
    case "scale": {
      const { scale, field } = encoding;
      const format = field.format;
      const steps = scale.classes;
      return (
        <div>
          {steps.length ? (
            <div className="flex h-2 overflow-hidden rounded-full">
              {steps.map((step, i) => (
                <i key={i} className="block flex-1" style={{ background: cssColor(step.color) }} />
              ))}
            </div>
          ) : (
            <i className="block h-2 rounded-full" style={{ background: gradient(scale.stops) }} />
          )}
          {field.discrete ? (
            <Ends
              left={`${scale.min}, ${field.ends?.[0] ?? "lowest"}`}
              right={`${scale.max}, ${field.ends?.[1] ?? "highest"}`}
            />
          ) : (
            <Ends
              left={format(steps[0]?.from ?? scale.min)}
              middle={scale.diverging ? format(0) : undefined}
              right={format(steps.at(-1)?.to ?? scale.max)}
            />
          )}
          {encoding.hasMissing && (
            <span className="mt-1.5 flex items-center gap-1.5">
              <Swatch color={missing} /> No data
            </span>
          )}
        </div>
      );
    }
    case "bubbles": {
      const sizes = [1, 0.5, 0.15];
      const largest = encoding.maxRadius;
      return (
        <div className="flex items-end gap-3">
          {sizes.map((share) => {
            const diameter = Math.max(3, Math.sqrt(share) * largest * 2);
            return (
              <span key={share} className="flex flex-col items-center gap-1">
                <i
                  className="block rounded-full border border-current opacity-70"
                  style={{ width: Math.min(diameter, 48), height: Math.min(diameter, 48) }}
                />
                {encoding.field.format(encoding.max * share)}
              </span>
            );
          })}
        </div>
      );
    }
    case "density":
      return (
        <div>
          <i className="block h-2 rounded-full" style={{ background: gradient(encoding.colors) }} />
          {view.config.display === "hexbins" && encoding.domain ? (
            <Ends
              left={
                encoding.field
                  ? encoding.field.format(encoding.domain[0])
                  : formatNumber(encoding.domain[0])
              }
              right={
                encoding.field
                  ? encoding.field.format(encoding.domain[1])
                  : formatNumber(encoding.domain[1])
              }
            />
          ) : (
            <Ends left="Fewer" right="More" />
          )}
        </div>
      );
    case "outline":
      return (
        <span className="flex items-center gap-1.5">
          <i
            className="block h-2.5 w-3.5 shrink-0 rounded-sm border-[1.5px]"
            style={{
              borderColor: cssColor([encoding.line[0], encoding.line[1], encoding.line[2]]),
              background: cssColor([encoding.fill[0], encoding.fill[1], encoding.fill[2]], 0.4),
            }}
          />
          {view.subtitle}
        </span>
      );
  }
}
const keyTitle = (encoding: Encoding) => ("title" in encoding ? encoding.title : null);

/** Quiet key for the visible layers, top of the list first. It never takes pointer events. */
export default function MapLegend() {
  const views = useLayerViews();
  const { missing } = useAtomValue(mapSurfacesAtom);
  const transition = useEnterTransition();
  const shown = views.filter((v) => v.config.visible && v.encoding);
  if (!shown.length) return null;
  const credits = shown.some(
    (v) => acaraFields.has(v.config.field ?? "") || acaraFields.has(v.config.colorBy ?? ""),
  );
  return (
    <div
      {...transition}
      className="glass panel-motion panel-motion--bottom pointer-events-none absolute right-4 bottom-4 hidden max-h-[calc(100%-7rem)] w-62 overflow-hidden rounded-xl px-3.5 py-3 md:block"
    >
      <div className="grid grid-cols-1 gap-3">
        {shown.map((view) => {
          const encoding = view.encoding!;
          const title = keyTitle(encoding);
          return (
            <section key={view.config.id} aria-label={`${view.title} legend`}>
              <div className="legend-title text-sm font-medium">{view.title}</div>
              <div className="mt-0.5 text-xs text-muted">
                {title && <span className="mb-1.5 block">{title}</span>}
                <Key encoding={encoding} view={view} missing={missing} />
              </div>
            </section>
          );
        })}
      </div>
      {credits && (
        <Typography type="body-xs" color="muted" className="mt-3">
          Source: Australian Curriculum, Assessment and Reporting Authority (ACARA)
        </Typography>
      )}
    </div>
  );
}
