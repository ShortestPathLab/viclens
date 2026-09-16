import { Typography } from "@heroui/react";
import type { Hover } from "./basemap";

// Keep the hover card inside the map, whichever edge the pointer is near.
export default function MapTooltip({
  hover,
  size,
}: {
  hover: Hover;
  size: { width: number; height: number };
}) {
  return (
    <div
      className="pointer-events-none absolute z-2 w-[240px] rounded-lg bg-overlay px-3 py-2.5 shadow-overlay"
      style={{
        left: Math.max(8, Math.min(hover.x + 14, size.width - 256)),
        top: Math.max(8, Math.min(hover.y - 64, size.height - 96)),
      }}
    >
      <Typography type="body-sm" weight="semibold">
        {hover.title}
      </Typography>
      <Typography type="body-xs" color="muted" className="mt-0.5">
        {hover.detail}
      </Typography>
    </div>
  );
}
