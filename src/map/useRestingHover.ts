import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Hover } from "./basemap";

/** How long the pointer has to stay still on a feature before its card appears. */
const REST_MS = 300;

/**
 * Hover state for the map's hover card. The card waits until the pointer stops on a feature, and
 * any movement hides it again. It also stays hidden where the legend or another surface covers the
 * map, even though the map still picks the feature underneath.
 */
export function useRestingHover(map: RefObject<HTMLElement | null>) {
  const [hover, setShown] = useState<Hover | null>(null);
  const timer = useRef<number>(undefined);
  const setHover = useCallback(
    (next: Hover | null) => {
      window.clearTimeout(timer.current);
      setShown(null);
      if (!next) return;
      timer.current = window.setTimeout(() => {
        if (map.current && !isCovered(map.current, next)) setShown(next);
      }, REST_MS);
    },
    [map],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [hover, setHover] as const;
}

// Panels catch the pointer, so the map clears its hover when the pointer moves onto one. The
// legend lets the pointer through, so this checks the point against every surface on screen,
// skipping any that are already closing.
function isCovered(map: HTMLElement, { x, y }: Hover) {
  const bounds = map.getBoundingClientRect();
  const left = bounds.left + x;
  const top = bounds.top + y;
  return [...document.querySelectorAll(".glass:not([data-exiting])")].some((surface) => {
    const r = surface.getBoundingClientRect();
    return left >= r.left && left < r.right && top >= r.top && top < r.bottom;
  });
}
