import type { Rgb } from "../state/palette";

export type Scheme = "light" | "dark";
export type PaletteId = "violet" | "teal" | "blue" | "orange";

interface Ramp {
  id: PaletteId;
  label: string;
  /** Hue at the low end and at the high end. A small drift keeps the light steps from going grey. */
  hue: [number, number];
  chroma: number;
}
const ramps: Ramp[] = [
  { id: "violet", label: "Violet", hue: [305, 285], chroma: 0.17 },
  { id: "teal", label: "Teal", hue: [175, 200], chroma: 0.12 },
  { id: "blue", label: "Blue", hue: [230, 262], chroma: 0.16 },
  { id: "orange", label: "Orange", hue: [85, 32], chroma: 0.18 },
];
export const paletteOptions = ramps.map(({ id, label }) => ({ id, label }));

const toSrgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
function oklabToLinear(l: number, a: number, b: number) {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}
/**
 * An OKLCH colour as sRGB. Chroma the screen cannot show is given up rather than clipped per
 * channel, which would shift the hue at the vivid end of a ramp.
 */
export function oklch(l: number, c: number, h: number): Rgb {
  const rad = (h * Math.PI) / 180;
  let lo = 0;
  let hi = c;
  let rgb = oklabToLinear(l, 0, 0);
  for (let i = 0; i < 16; i++) {
    const mid = i === 0 ? c : (lo + hi) / 2;
    const candidate = oklabToLinear(l, mid * Math.cos(rad), mid * Math.sin(rad));
    if (candidate.every((v) => v >= -0.0001 && v <= 1.0001)) {
      rgb = candidate;
      if (i === 0) break;
      lo = mid;
    } else hi = mid;
  }
  return rgb.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255)) as Rgb;
}

/**
 * A sequential colour at `t` from 0 to 1. Light runs pale to deep. Dark runs the other way, so the
 * high end is always the step that stands furthest from the map underneath.
 */
export function rampColor(id: PaletteId, t: number, scheme: Scheme): Rgb {
  const ramp = ramps.find((r) => r.id === id) ?? ramps[0];
  const x = Math.min(1, Math.max(0, t));
  const l = scheme === "light" ? 0.95 - 0.57 * x : 0.32 + 0.58 * x;
  const c = ramp.chroma * (0.22 + 0.78 * Math.sin((Math.PI / 2) * Math.min(1, x * 1.15)));
  return oklch(l, c, ramp.hue[0] + (ramp.hue[1] - ramp.hue[0]) * x);
}
/**
 * The diverging pair for change: red for a fall, blue for a rise, and a neutral grey at zero that
 * sits close to the map so "no change" recedes. `t` runs from -1 to 1.
 */
export function divergingColor(t: number, scheme: Scheme): Rgb {
  const x = Math.min(1, Math.max(-1, t));
  const a = Math.abs(x);
  const l = scheme === "light" ? 0.93 - 0.42 * a : 0.36 + 0.4 * a;
  return oklch(l, 0.16 * a ** 0.85, x < 0 ? 27 : 255);
}
/** `n` evenly spaced steps of a ramp between `from` and `to`. */
export function rampSteps(id: PaletteId, n: number, scheme: Scheme, from = 0, to = 1): Rgb[] {
  return Array.from({ length: n }, (_, i) =>
    rampColor(id, n === 1 ? to : from + ((to - from) * i) / (n - 1), scheme),
  );
}
export const cssColor = (rgb: Rgb, alpha = 1) =>
  alpha === 1 ? `rgb(${rgb.join(" ")})` : `rgb(${rgb.join(" ")} / ${alpha})`;
