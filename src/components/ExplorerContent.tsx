import { useAtom } from "jotai";
import { Tabs, Typography } from "@heroui/react";
import { panelTabAtom } from "../state/atoms";
import AboutDrawer from "./AboutDrawer";
import LayerControls from "./LayerControls";
import ResultsList from "./ResultsList";
import SearchFilters from "./SearchFilters";
import StatusBar from "./StatusBar";
import ThemeToggle from "./ThemeToggle";

const panel = "panel-scroll min-h-0 min-w-0 flex-1 py-5";
export default function ExplorerContent() {
  const [tab, setTab] = useAtom(panelTabAtom);
  return (
    <>
      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as "schools" | "layers")}
      >
        {/* The list container is the pill itself, so the gutter belongs on a wrapper around it. */}
        <div className="shrink-0 px-5">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Explorer sections">
              <Tabs.Tab id="schools">
                Schools
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="layers">
                Map layers
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </div>
        <Tabs.Panel id="schools" className={panel}>
          <div id="school-results" tabIndex={-1} className="grid grid-cols-1 gap-5">
            <SearchFilters />
            <ResultsList />
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="layers" className={panel}>
          <LayerControls />
        </Tabs.Panel>
      </Tabs>
      <StatusBar />
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-separator px-3 py-2">
        <Typography type="body-xs" color="muted" className="pl-2">
          Victoria · 2025 / 26
        </Typography>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AboutDrawer />
        </div>
      </footer>
    </>
  );
}
