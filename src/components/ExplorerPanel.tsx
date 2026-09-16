import { Button, Drawer, Typography } from "@heroui/react";
import { useAtom } from "jotai";
import { ListFilter } from "lucide-react";
import { mobileOpenAtom } from "../state/atoms";
import ExplorerContent from "./ExplorerContent";
import { useIsDesktop } from "./useMediaQuery";

function Brand() {
  return <Typography type="h4">Schools</Typography>;
}
export default function ExplorerPanel() {
  const [open, setOpen] = useAtom(mobileOpenAtom);
  const isDesktop = useIsDesktop();
  // One panel exists at a time: a card floating over the map, or a drawer on a phone.
  if (isDesktop)
    return (
      <aside
        id="explorer-panel"
        className="absolute inset-y-4 left-4 z-3 flex w-[366px] flex-col overflow-hidden rounded-2xl bg-surface shadow-overlay scrollbar"
        aria-label="School explorer"
      >
        <header className="shrink-0 px-5 pt-5 pb-4">
          <Brand />
        </header>
        <ExplorerContent />
      </aside>
    );
  return (
    <Drawer
      state={{
        isOpen: open,
        setOpen,
        open: () => setOpen(true),
        close: () => setOpen(false),
        toggle: () => setOpen(!open),
      }}
    >
      {/* The floating button is the drawer's trigger, so it keeps focus return for free. */}
      <Button
        variant="primary"
        className="absolute right-4 bottom-[calc(var(--sheet-h)+1rem)] z-4 shadow-overlay"
        aria-controls="explorer-panel"
      >
        <ListFilter size={16} />
        Schools
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog id="explorer-panel" aria-label="School explorer" className="flex flex-col">
            <Drawer.Handle />
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Brand />
            </Drawer.Header>
            <ExplorerContent />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
