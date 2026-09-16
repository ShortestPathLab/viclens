import { useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";

/**
 * Timing for the animations driven from JavaScript. The panels' CSS animations use the same numbers,
 * taken from HeroUI's drawer: 250ms in and 200ms out, on its fluid curve.
 */
export const FLUID_EASE = [0.32, 0.72, 0, 1] as const;
export const ENTER_SECONDS = 0.25;
export const EXIT_SECONDS = 0.2;

/** A fluid transition of the given length, or an instant one when the browser asks for less motion. */
export function useFluidTransition(seconds: number = ENTER_SECONDS): Transition {
  const reduce = useReducedMotion();
  return { duration: reduce ? 0 : seconds, ease: FLUID_EASE };
}
