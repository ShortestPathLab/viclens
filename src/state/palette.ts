import { atom } from "jotai";
import { resolvedThemeAtom } from "./theme";

export type Rgb = [number, number, number];
type Rgba = [number, number, number, number];
type Scheme = "light" | "dark";

// Category colours follow Apple's system palette: five well separated hues that stay vivid on a
// pale basemap and on a dark one, with the brighter variants used in dark.
const byScheme = <T>(light: T, dark: T): Record<Scheme, T> => ({ light, dark });
export const typeColorsByScheme = byScheme<Record<string, Rgb>>(
  {
    Primary: [0, 122, 255],
    Secondary: [255, 149, 0],
    "Pri/Sec": [175, 82, 222],
    Special: [52, 199, 89],
    Language: [255, 45, 85],
  },
  {
    Primary: [10, 132, 255],
    Secondary: [255, 159, 10],
    "Pri/Sec": [191, 90, 242],
    Special: [48, 209, 88],
    Language: [255, 55, 95],
  },
);
export const regionColorsByScheme = byScheme<Record<string, Rgb>>(
  {
    "North-Eastern Victoria": [88, 86, 214],
    "North-Western Victoria": [50, 173, 230],
    "South-Eastern Victoria": [255, 149, 0],
    "South-Western Victoria": [255, 45, 85],
  },
  {
    "North-Eastern Victoria": [94, 92, 230],
    "North-Western Victoria": [100, 210, 255],
    "South-Eastern Victoria": [255, 159, 10],
    "South-Western Victoria": [255, 55, 95],
  },
);
export interface MapSurfaces {
  zoneFill: Rgba;
  zoneFillSelected: Rgba;
  zoneLine: Rgba;
  zoneLineSelected: Rgba;
  lgaFill: Rgba;
  lgaLine: Rgba;
  markerOutline: Rgba;
  selectedRing: Rgb;
  land: Rgb;
  landLine: Rgb;
  cityText: Rgb;
  cityOutline: Rgb;
  fallback: Rgb;
}
// Everything under the markers. Zones and boundaries stay neutral so the category hues above are
// the only saturated thing on the map.
export const mapSurfacesByScheme = byScheme<MapSurfaces>(
  {
    zoneFill: [100, 116, 139, 12],
    zoneFillSelected: [71, 85, 105, 48],
    zoneLine: [100, 116, 139, 85],
    zoneLineSelected: [51, 65, 85, 235],
    lgaFill: [99, 91, 132, 10],
    lgaLine: [110, 87, 143, 200],
    markerOutline: [255, 255, 255, 235],
    selectedRing: [22, 28, 38],
    land: [235, 238, 226],
    landLine: [180, 195, 186],
    cityText: [83, 103, 99],
    cityOutline: [235, 238, 226],
    fallback: [120, 128, 138],
  },
  {
    zoneFill: [148, 163, 184, 18],
    zoneFillSelected: [148, 163, 184, 62],
    zoneLine: [148, 163, 184, 95],
    zoneLineSelected: [226, 232, 240, 235],
    lgaFill: [151, 132, 181, 20],
    lgaLine: [151, 132, 181, 205],
    markerOutline: [16, 20, 26, 235],
    selectedRing: [240, 246, 252],
    land: [30, 38, 36],
    landLine: [58, 72, 68],
    cityText: [176, 196, 189],
    cityOutline: [22, 30, 28],
    fallback: [130, 140, 150],
  },
);
export const typeColorsAtom = atom((get) => typeColorsByScheme[get(resolvedThemeAtom)]);
export const regionColorsAtom = atom((get) => regionColorsByScheme[get(resolvedThemeAtom)]);
export const mapSurfacesAtom = atom((get) => mapSurfacesByScheme[get(resolvedThemeAtom)]);
/** `rgb(r g b)` for a CSS background, with a neutral when a category is unknown. */
export const cssRgb = (rgb: Rgb | undefined, fallback: Rgb = [120, 128, 138]) =>
  `rgb(${(rgb ?? fallback).join(" ")})`;
