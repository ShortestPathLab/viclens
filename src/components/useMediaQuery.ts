import { useSyncExternalStore } from "react";

const queries = new Map<string, MediaQueryList>();
const list = (query: string) => {
  let mql = queries.get(query);
  if (!mql) queries.set(query, (mql = window.matchMedia(query)));
  return mql;
};
/** Reads a media query as state, so layout can branch on it without an effect. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mql = list(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => list(query).matches,
    () => false,
  );
}
/** Matches the one breakpoint in the stylesheet, where the panel stops being a drawer. */
export const useIsDesktop = () => useMediaQuery("(min-width: 760px)");
