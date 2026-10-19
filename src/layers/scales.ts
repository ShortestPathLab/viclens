import type { Rgb } from "../state/palette";
import { divergingColor, rampColor } from "./palettes";
import type { PaletteId, Scheme } from "./palettes";

export type ClassMethod = "quantile" | "equal" | "continuous";
export const classOptions: { id: ClassMethod; label: string }[] = [
  { id: "quantile", label: "Quantiles" },
  { id: "equal", label: "Equal intervals" },
  { id: "continuous", label: "Continuous" },
];

export interface ScaleClass {
  from: number;
  to: number;
  color: Rgb;
}
export interface Scale {
  /** Classes for a stepped scale; empty for a continuous one. */
  classes: ScaleClass[];
  /** The colours along the scale, for a gradient legend. */
  stops: Rgb[];
  min: number;
  max: number;
  diverging: boolean;
  color: (value: number) => Rgb;
}
export interface ScaleOptions {
  method: ClassMethod;
  palette: PaletteId;
  scheme: Scheme;
  diverging?: boolean;
  /** Whole-number values on a fixed range, such as deciles, get one class per value. */
  discrete?: [number, number];
  /** Points sit on the map rather than filling it, so they skip the palest steps. */
  floor?: number;
}

const CLASSES = 5;
function quantileOf(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
function classIndex(breaks: number[], value: number) {
  let i = 0;
  while (i < breaks.length && value > breaks[i]) i++;
  return i;
}

/**
 * A colour scale over the values in view. The extent is trimmed to the 2nd and 98th percentiles
 * for continuous and equal-interval scales, so one outlier does not wash the rest into a single
 * colour; values past the trim take the end colours. A diverging scale is symmetric about zero.
 */
export function buildScale(values: number[], options: ScaleOptions): Scale | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const { scheme, palette, floor = 0 } = options;
  const at = (t: number) => rampColor(palette, floor + (1 - floor) * t, scheme);
  const lo = quantileOf(sorted, 0.02);
  const hi = quantileOf(sorted, 0.98);

  if (options.diverging) {
    const extent = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    const stops = [-1, -0.5, 0, 0.5, 1].map((t) => divergingColor(t, scheme));
    if (options.method === "continuous")
      return {
        classes: [],
        stops,
        min: -extent,
        max: extent,
        diverging: true,
        color: (v) => divergingColor(v / extent, scheme),
      };
    // Three steps either side of zero, the middle pair straddling it.
    const step = extent / 3;
    const bounds = [-step * 2, -step, 0, step, step * 2];
    const classes = [-3, -2, -1, 1, 2, 3].map((k, i) => ({
      from: i === 0 ? sorted[0] : bounds[i - 1],
      to: i === 5 ? sorted[sorted.length - 1] : bounds[i],
      color: divergingColor(k / 3, scheme),
    }));
    return {
      classes,
      stops,
      min: -extent,
      max: extent,
      diverging: true,
      color: (v) => classes[classIndex(bounds, v)].color,
    };
  }

  const stops = [0, 0.25, 0.5, 0.75, 1].map(at);
  if (options.discrete) {
    const [first, last] = options.discrete;
    const span = Math.max(1, last - first);
    const classes = Array.from({ length: span + 1 }, (_, i) => ({
      from: first + i,
      to: first + i,
      color: at(i / span),
    }));
    return {
      classes,
      stops,
      min: first,
      max: last,
      diverging: false,
      color: (v) => classes[Math.min(span, Math.max(0, Math.round(v) - first))].color,
    };
  }
  if (options.method === "continuous" || hi === lo) {
    const span = hi - lo || 1;
    return {
      classes: [],
      stops,
      min: lo,
      max: hi,
      diverging: false,
      color: (v) => at((v - lo) / span),
    };
  }
  const breaks =
    options.method === "quantile"
      ? [...new Set([1, 2, 3, 4].map((i) => quantileOf(sorted, i / CLASSES)))]
      : [1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / CLASSES);
  const count = breaks.length + 1;
  const classes = Array.from({ length: count }, (_, i) => ({
    from: i === 0 ? sorted[0] : breaks[i - 1],
    to: i === count - 1 ? sorted[sorted.length - 1] : breaks[i],
    color: at(count === 1 ? 1 : i / (count - 1)),
  }));
  return {
    classes,
    stops,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    diverging: false,
    color: (v) => classes[classIndex(breaks, v)].color,
  };
}
