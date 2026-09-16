import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type ThemePreference = "system" | "light" | "dark";
// `getOnInit` reads the stored choice during initialisation, so a reload does not flash the
// device scheme before the saved one arrives.
export const themeAtom = atomWithStorage<ThemePreference>("theme", "system", undefined, {
  getOnInit: true,
});
const darkQuery =
  typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)");
// The atom starts from the device's current answer rather than learning it on mount. Components
// subscribe one by one after they have rendered, and a value that changed when the first of them
// mounted this atom would never reach the ones that subscribed after it.
const systemDark = atom(darkQuery?.matches ?? false);
systemDark.onMount = (set) => {
  if (!darkQuery) return;
  const read = () => set(darkQuery.matches);
  darkQuery.addEventListener("change", read);
  return () => darkQuery.removeEventListener("change", read);
};
/** The scheme actually in force, once "system" is resolved against the device. */
export const resolvedThemeAtom = atom<"light" | "dark">((get) => {
  const preference = get(themeAtom);
  if (preference !== "system") return preference;
  return get(systemDark) ? "dark" : "light";
});
