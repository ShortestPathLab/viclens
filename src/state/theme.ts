import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type ThemePreference = "system" | "light" | "dark";
// `getOnInit` reads the stored choice during initialisation, so a reload does not flash the
// device scheme before the saved one arrives.
export const themeAtom = atomWithStorage<ThemePreference>("theme", "system", undefined, {
  getOnInit: true,
});
const systemDark = atom(false);
systemDark.onMount = (set) => {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const read = () => set(mql.matches);
  read();
  mql.addEventListener("change", read);
  return () => mql.removeEventListener("change", read);
};
/** The scheme actually in force, once "system" is resolved against the device. */
export const resolvedThemeAtom = atom<"light" | "dark">((get) => {
  const preference = get(themeAtom);
  if (preference !== "system") return preference;
  return get(systemDark) ? "dark" : "light";
});
