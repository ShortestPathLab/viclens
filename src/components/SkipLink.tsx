import { useSetAtom } from "jotai";
import { mobileOpenAtom, panelTabAtom } from "../state/atoms";

// On a phone the list lives in a drawer that starts closed, so the link has to open it first.
export default function SkipLink() {
  const setMobileOpen = useSetAtom(mobileOpenAtom);
  const setTab = useSetAtom(panelTabAtom);
  return (
    <a
      className="absolute -top-25 left-5 z-20 rounded-lg bg-surface p-3 text-sm shadow-overlay focus:top-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href="#school-results"
      onClick={(e) => {
        e.preventDefault();
        setTab("schools");
        setMobileOpen(true);
        requestAnimationFrame(() => document.getElementById("school-results")?.focus());
      }}
    >
      Skip map to school results
    </a>
  );
}
