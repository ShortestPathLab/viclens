import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { ENTER_SECONDS, FLUID_EASE } from "../transitions";

export interface Padding {
  left: number;
  bottom: number;
}

/**
 * The map's viewport padding, eased towards `target` on the panels' own timing. Padding decides
 * where the middle of the visible map is, so jumping to a new value would shove the whole map
 * sideways at the moment a panel opens or closes. Easing it lets the map glide over while the panel
 * slides in.
 */
export function useEasedPadding(target: Padding): Padding {
  const [padding, setPadding] = useState(target);
  const current = useRef(target);
  const reduce = useReducedMotion();
  const { left, bottom } = target;
  useEffect(() => {
    const from = current.current;
    if (from.left === left && from.bottom === bottom) return;
    const set = (next: Padding) => {
      current.current = next;
      setPadding(next);
    };
    if (reduce) return set({ left, bottom });
    const controls = animate(0, 1, {
      duration: ENTER_SECONDS,
      ease: FLUID_EASE,
      onUpdate: (t) =>
        set({
          left: from.left + (left - from.left) * t,
          bottom: from.bottom + (bottom - from.bottom) * t,
        }),
    });
    return () => controls.stop();
  }, [left, bottom, reduce]);
  return padding;
}
