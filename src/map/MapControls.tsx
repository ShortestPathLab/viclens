import { useSetAtom } from "jotai";
import { Button, Toolbar } from "@heroui/react";
import { WebMercatorViewport } from "@deck.gl/core";
import { Maximize2, Minus, Plus } from "lucide-react";
import { viewAtom } from "../state/atoms";
import { useEnterTransition } from "../components/Presence";
import { flyTo, initialCamera, zoomTo } from "../state/camera";

const victoria: [[number, number], [number, number]] = [
  [140.9, -39.3],
  [150.05, -33.9],
];
export default function MapControls({
  size,
  padding,
}: {
  size: { width: number; height: number };
  padding: { left: number };
}) {
  const setView = useSetAtom(viewAtom);
  const transition = useEnterTransition();
  return (
    <Toolbar
      {...transition}
      orientation="vertical"
      aria-label="Map camera"
      className="glass panel-motion panel-motion--right absolute top-4 right-4 gap-1 rounded-xl p-1"
    >
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label="Zoom in"
        onPress={() => setView((v) => zoomTo({ ...v, zoom: Math.min(18, v.zoom + 1) }))}
      >
        <Plus size={16} />
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label="Zoom out"
        onPress={() => setView((v) => zoomTo({ ...v, zoom: Math.max(4, v.zoom - 1) }))}
      >
        <Minus size={16} />
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label="Fit Victoria"
        onPress={() => {
          // The panel floats over the map, so the fit has to clear the space it covers.
          const fitted = new WebMercatorViewport(size).fitBounds(victoria, {
            padding: { top: 48, bottom: 48, right: 48, left: padding.left + 48 },
          });
          setView(
            flyTo({
              ...initialCamera,
              longitude: fitted.longitude,
              latitude: fitted.latitude,
              zoom: fitted.zoom,
            }),
          );
        }}
      >
        <Maximize2 size={15} />
      </Button>
    </Toolbar>
  );
}
