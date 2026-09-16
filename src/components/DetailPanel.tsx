import { useAtom } from "jotai";
import { CloseButton } from "@heroui/react";
import { selectedSchoolAtom } from "../state/atoms";
import ContentTransition from "./ContentTransition";
import Presence from "./Presence";
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
  return (
    <Presence value={selected}>
      {(school, transition) => {
        // Focus returns to the row the school was opened from. On a phone that row sits in a
        // drawer that closed when the school opened, so the fall back is the control that reopens
        // it.
        const close = () => {
          setSelected(null);
          requestAnimationFrame(() => {
            const target =
              document.querySelector<HTMLElement>(
                `.school-row[data-key="${CSS.escape(school.id)}"]`,
              ) ??
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
              {...transition}
              className="glass panel-motion panel-motion--left absolute top-4 left-[var(--detail-left)] z-3 flex max-h-[calc(100%-2rem)] w-[var(--detail-w)] flex-col overflow-hidden rounded-2xl"
              aria-label="School details"
            >
              {dismiss}
              {/* The panel is as tall as the school's details, up to the height of the map, and
                  eases between heights as the school changes. */}
              <ContentTransition id={school.id} fit className="panel-scroll py-5">
                <SchoolDetail school={school} />
              </ContentTransition>
            </aside>
          );
        return (
          <aside
            {...transition}
            className="glass panel-motion panel-motion--sheet absolute inset-x-0 bottom-0 z-3 flex h-[var(--sheet-h)] flex-col rounded-t-2xl"
            aria-label="School details"
          >
            {dismiss}
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-default" />
            <ContentTransition id={school.id} className="panel-scroll py-3">
              <SchoolDetail school={school} />
            </ContentTransition>
          </aside>
        );
      }}
    </Presence>
  );
}
