import { Typography } from "@heroui/react";
import { useAtomValue } from "jotai";
import { typeNames } from "../data";
import {
  colorByRegionAtom,
  showLgasAtom,
  showZonesAtom,
  sizeByEnrolmentAtom,
  zoneLevelAtom,
} from "../state/atoms";
import { cssRgb, regionColorsAtom, typeColorsAtom } from "../state/palette";
import { useEnterTransition } from "./Presence";

/** Quiet key for the active encodings. It never takes pointer events away from the map. */
export default function MapLegend() {
  const colorByRegion = useAtomValue(colorByRegionAtom);
  const sizeByEnrolment = useAtomValue(sizeByEnrolmentAtom);
  const showZones = useAtomValue(showZonesAtom);
  const showLgas = useAtomValue(showLgasAtom);
  const zoneLevel = useAtomValue(zoneLevelAtom);
  const typeColors = useAtomValue(typeColorsAtom);
  const regionColors = useAtomValue(regionColorsAtom);
  const transition = useEnterTransition();
  return (
    <div
      {...transition}
      className="glass panel-motion panel-motion--bottom pointer-events-none absolute right-4 bottom-4 hidden max-w-[240px] rounded-xl px-3.5 py-3 md:block"
    >
      <div className="legend-title mb-2 font-medium">
        {colorByRegion ? "Education region" : "School type"}
      </div>
      <Typography type="body-xs" color="muted" className="flex flex-wrap gap-x-3 gap-y-1.5">
        {Object.entries(colorByRegion ? regionColors : typeColors).map(([label, rgb]) => (
          <span key={label} className="flex items-center gap-1.5">
            <i className="block size-2 rounded-full" style={{ background: cssRgb(rgb) }} />
            {(typeNames[label] ?? label).replace(" Victoria", "")}
          </span>
        ))}
      </Typography>
      {sizeByEnrolment && (
        <Typography type="body-xs" color="muted" className="mt-2">
          Radius follows FTE. Faded means no data.
        </Typography>
      )}
      {showZones && (
        <Typography type="body-xs" color="muted" className="mt-2 flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 border border-zone-line bg-zone-fill" />
          2026 zones · {zoneLevel === "P6" ? "Prep–6" : `Year ${zoneLevel}`}
        </Typography>
      )}
      {showLgas && (
        <Typography type="body-xs" color="muted" className="mt-1.5 flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 border-[1.5px] border-lga-line bg-lga-fill" />
          Local government areas
        </Typography>
      )}
    </div>
  );
}
