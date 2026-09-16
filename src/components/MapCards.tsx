import type { ReactNode } from "react";
import { useAtomValue } from "jotai";
import { selectedSchoolAtom } from "../state/atoms";

/**
 * The cards that report on the map: the local government summary and the notice for a zone with
 * no school. They stack in the top left of the open map, clear of the camera controls. On a wider
 * screen that means just right of the panels, and the stack slides along with that edge as the
 * detail panel opens and closes.
 */
export default function MapCards({ children }: { children: ReactNode }) {
  const hasDetail = useAtomValue(selectedSchoolAtom) !== null;
  return (
    <div
      className="map-cards absolute top-4 right-[var(--controls-clearance)] left-4 z-5 flex flex-col gap-3 md:right-auto md:left-[var(--map-inset)] md:w-[var(--card-w)]"
      data-beside-detail={hasDetail || undefined}
    >
      {children}
    </div>
  );
}
