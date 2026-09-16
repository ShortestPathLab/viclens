import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { resolvedThemeAtom } from "./state/theme";
import ExplorerPanel from "./components/ExplorerPanel";
import LgaCard from "./components/LgaCard";
import MapCards from "./components/MapCards";
import MapLegend from "./components/MapLegend";
import DetailPanel from "./components/DetailPanel";
import SkipLink from "./components/SkipLink";
import ZoneAlert from "./components/ZoneAlert";
import SchoolMap from "./map/SchoolMap";

export default function App() {
  const theme = useAtomValue(resolvedThemeAtom);
  // HeroUI reads the scheme from a data attribute on the root element.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <main className="relative h-dvh min-h-[420px] w-full overflow-hidden">
      <SkipLink />
      <SchoolMap />
      <ExplorerPanel />
      <DetailPanel />
      <MapLegend />
      <MapCards>
        <LgaCard />
        <ZoneAlert />
      </MapCards>
    </main>
  );
}
