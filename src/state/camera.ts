import { FlyToInterpolator, LinearInterpolator, TransitionInterpolator } from "@deck.gl/core";
import type { MapViewState } from "@deck.gl/core";

export interface Camera extends MapViewState {
  transitionDuration?: number | "auto";
  transitionInterpolator?: TransitionInterpolator;
  transitionEasing?: (t: number) => number;
}
export const initialCamera: Camera = {
  longitude: 144.85,
  latitude: -37.35,
  zoom: 7.3,
  pitch: 0,
  bearing: 0,
};
// A camera flight is motion like any other, so it follows the same preference as the stylesheet.
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// Duration is derived from the distance travelled, so a jump across the state takes longer than a
// hop to the next suburb. At this speed those two cases land at roughly 1.6s and 1s.
const flight = new FlyToInterpolator({ speed: 2.4 });
const straight = new LinearInterpolator(["zoom"]);

/** Arc out and back in, which keeps the geography in between readable on a long jump. */
export const flyTo = (camera: Camera): Camera =>
  prefersReducedMotion()
    ? camera
    : {
        ...camera,
        transitionDuration: "auto",
        transitionInterpolator: flight,
        transitionEasing: easeInOutCubic,
      };
/** One zoom step has nowhere to arc to, so it interpolates straight. */
export const zoomTo = (camera: Camera): Camera =>
  prefersReducedMotion()
    ? camera
    : {
        ...camera,
        transitionDuration: 300,
        transitionInterpolator: straight,
        transitionEasing: easeInOutCubic,
      };
/**
 * deck.gl reports each interpolated frame back through `onViewStateChange`. Storing those frames
 * with the transition settings still attached would make the next drag ask for a new transition on
 * every pointer move, so the settings are dropped on the way in and re-added only when something
 * asks for a flight.
 */
export function withoutTransition(camera: Camera): Camera {
  const {
    transitionDuration: _duration,
    transitionInterpolator: _interpolator,
    transitionEasing: _easing,
    ...rest
  } = camera;
  return rest;
}
