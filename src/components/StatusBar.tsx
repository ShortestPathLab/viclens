import { useMemo } from "react";
import { Typography } from "@heroui/react";
import { formatNumber, summarise } from "../data";
import { useVisibleSchools } from "../state/hooks";

/** A fixed line under the panel's scrolling area, reporting what the current filters select. */
export default function StatusBar() {
  const visible = useVisibleSchools();
  const totals = useMemo(() => summarise(visible), [visible]);
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-separator px-5 py-1.5">
      <Typography type="body-xs" color="muted" className="count" aria-live="polite">
        {formatNumber(visible.length)} {visible.length === 1 ? "school" : "schools"}
      </Typography>
      <Typography type="body-xs" color="muted" truncate>
        {formatNumber(totals.total)} FTE from {formatNumber(totals.matched)}
      </Typography>
    </div>
  );
}
