import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createLayer, newLayerId, normalise, datasets } from "./model";
import type { DatasetId, LayerConfig } from "./model";

/** What the map shows on a first visit: every school coloured by type, over primary zones. */
export const defaultLayers = (): LayerConfig[] => [createLayer("schools"), createLayer("zones")];

// The list is kept per browser, so an arrangement survives a reload. Whatever comes back from
// storage is checked against the current catalogue before the map reads it.
const storedLayersAtom = atomWithStorage<unknown>("map-layers", null, undefined, {
  getOnInit: true,
});
const isDataset = (value: unknown): value is DatasetId =>
  typeof value === "string" && value in datasets;
const sanitised = new WeakMap<object, LayerConfig[]>();
let fallback: LayerConfig[] | null = null;
function sanitise(stored: unknown): LayerConfig[] {
  if (!Array.isArray(stored)) return (fallback ??= defaultLayers());
  let layers = sanitised.get(stored);
  if (!layers) {
    const seen = new Set<string>();
    layers = stored
      .filter((item): item is LayerConfig => isDataset(item?.dataset))
      .map((item) => normalise(item))
      .filter((layer) => !seen.has(layer.id) && seen.add(layer.id));
    sanitised.set(stored, layers);
  }
  return layers;
}
/** The layers from the top of the list down. The first one is drawn on top. */
export const layersAtom = atom(
  (get) => sanitise(get(storedLayersAtom)),
  (_get, set, next: LayerConfig[]) => set(storedLayersAtom, next),
);
/** The layer whose settings are open. One at a time keeps the narrow panel readable. */
export const expandedLayerAtom = atom<string | null>(null);

const isArea = (dataset: DatasetId) =>
  dataset === "zones" || dataset === "lgas" || dataset === "sa2";
export const addLayerAtom = atom(null, (get, set, dataset: DatasetId) => {
  const layer = createLayer(dataset);
  const layers = get(layersAtom);
  // Points go on top. Areas go under any points already above them, so a new choropleth does not
  // bury the schools; the list order stays the user's to change.
  const index = isArea(dataset) ? layers.findIndex((l) => isArea(l.dataset)) : 0;
  const at = index < 0 ? layers.length : index;
  set(layersAtom, [...layers.slice(0, at), layer, ...layers.slice(at)]);
  set(expandedLayerAtom, layer.id);
  return layer;
});
export const updateLayerAtom = atom(
  null,
  (get, set, id: string, patch: Partial<Omit<LayerConfig, "id">>) => {
    set(
      layersAtom,
      get(layersAtom).map((layer) => {
        if (layer.id !== id) return layer;
        // A new dataset starts from that dataset's own defaults; only the list settings carry over.
        if (patch.dataset && patch.dataset !== layer.dataset)
          return normalise({
            id,
            dataset: patch.dataset,
            visible: layer.visible,
            opacity: layer.opacity,
          });
        const next = { ...layer, ...patch };
        // Size means something different to each display, so a new display starts at its own.
        if (patch.display && patch.display !== layer.display) {
          delete next.size;
          delete next.aggregation;
        }
        // Bins switch between a total and an average with the weight, unless asked otherwise.
        if (patch.field && layer.display === "hexbins" && !patch.aggregation)
          delete next.aggregation;
        return normalise(next);
      }),
    );
  },
);
export const removeLayerAtom = atom(null, (get, set, id: string) => {
  set(
    layersAtom,
    get(layersAtom).filter((layer) => layer.id !== id),
  );
  if (get(expandedLayerAtom) === id) set(expandedLayerAtom, null);
});
export const duplicateLayerAtom = atom(null, (get, set, id: string) => {
  const layers = get(layersAtom);
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) return;
  const copy = { ...layers[index], id: newLayerId() };
  set(layersAtom, [...layers.slice(0, index), copy, ...layers.slice(index)]);
  set(expandedLayerAtom, copy.id);
});
export const moveLayerAtom = atom(null, (get, set, from: string, to: string) => {
  const layers = [...get(layersAtom)];
  const a = layers.findIndex((layer) => layer.id === from);
  const b = layers.findIndex((layer) => layer.id === to);
  if (a < 0 || b < 0 || a === b) return;
  const [moved] = layers.splice(a, 1);
  layers.splice(b, 0, moved);
  set(layersAtom, layers);
});
export const resetLayersAtom = atom(null, (_get, set) => {
  set(layersAtom, defaultLayers());
  set(expandedLayerAtom, null);
});

/** An area opened from the map or from a layer's area picker. */
export interface SelectedArea {
  dataset: "lgas" | "sa2";
  code: string;
}
export const selectedAreaAtom = atom<SelectedArea | null>(null);
/** The domain each hexagon layer settled on, reported back by deck.gl for the legend. */
export const binDomainsAtom = atom<Record<string, [number, number]>>({});
/** The area card shows while its area is selected and a visible layer still draws that dataset. */
export const openAreaAtom = atom((get) => {
  const area = get(selectedAreaAtom);
  return area && get(layersAtom).some((layer) => layer.dataset === area.dataset && layer.visible)
    ? area
    : null;
});
