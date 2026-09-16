import { useAtom } from "jotai";
import { CloseButton } from "@heroui/react";
import { selectedSchoolAtom } from "../state/atoms";
import SchoolDetail from "./SchoolDetail";
import { useIsDesktop } from "./useMediaQuery";

/**
 * A selected school opens beside the explorer rather than replacing the list inside it, so the
 * result you came from stays in view. On a phone the same content rests on the map as a sheet,
 * which keeps the map live behind it instead of dimming it the way a modal drawer would.
 */
export default function DetailPanel() {
  const [selected, setSelected] = useAtom(selectedSchoolAtom);
  const isDesktop = useIsDesktop();
  if (!selected) return null;
  // Focus returns to the row the school was opened from. On a phone that row sits in a drawer
  // that closed when the school opened, so the fall back is the control that reopens it.
  const close = () => {
    const id = selected.id;
    setSelected(null);
    requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>(`.school-row[data-key="${CSS.escape(id)}"]`) ??
        document.getElementById("school-results") ??
        document.querySelector<HTMLElement>('[aria-controls="explorer-panel"]');
      target?.focus();
    });
  };
  const dismiss = (
    <CloseButton
      aria-label="Close school details"
      className="absolute top-3 right-3 z-1"
      onPress={close}
    />
  );
  if (isDesktop)
    return (
      <aside
        className="absolute inset-y-4 left-[var(--detail-left)] z-3 w-[var(--detail-w)] rounded-2xl bg-surface shadow-overlay"
        aria-label="School details"
      >
        {dismiss}
        <div className="panel-scroll h-full py-5">
          <SchoolDetail key={selected.id} school={selected} />
        </div>
      </aside>
    );
  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-3 flex h-[var(--sheet-h)] flex-col rounded-t-2xl bg-surface shadow-overlay"
      aria-label="School details"
    >
      {dismiss}
      <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-default" />
      <div className="panel-scroll min-h-0 flex-1 py-3">
        <SchoolDetail key={selected.id} school={selected} />
      </div>
    </aside>
  );
}
