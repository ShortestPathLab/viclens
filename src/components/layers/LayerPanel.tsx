import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Announcements, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button, Description, Dropdown, EmptyState, Label, Typography } from "@heroui/react";
import { Layers, Plus, RotateCcw } from "lucide-react";
import { datasetOrder, datasets } from "../../layers/model";
import type { DatasetId } from "../../layers/model";
import {
  addLayerAtom,
  expandedLayerAtom,
  layersAtom,
  moveLayerAtom,
  resetLayersAtom,
} from "../../layers/state";
import { useLayerViews } from "../../layers/useLayerViews";
import { EXIT_SECONDS, useFluidTransition } from "../../transitions";
import LayerCard, { LayerDragCopy } from "./LayerCard";

function AddLayerMenu({ variant = "secondary" }: { variant?: "secondary" | "primary" }) {
  const add = useSetAtom(addLayerAtom);
  return (
    <Dropdown>
      <Button size="sm" variant={variant}>
        <Plus size={15} /> Add layer
      </Button>
      <Dropdown.Popover placement="bottom end" className="w-75">
        <Dropdown.Menu aria-label="Datasets" onAction={(key) => add(key as DatasetId)}>
          {datasetOrder.map((id) => (
            <Dropdown.Item key={id} id={id} textValue={datasets[id].label}>
              <div className="flex flex-col">
                <Label>{datasets[id].label}</Label>
                <Description>{datasets[id].description}</Description>
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/**
 * The map's layers as an ordered list. The top of the list draws on top of the map, the way a
 * stack of transparencies would, and any layer can be dragged to another place in the stack.
 */
export default function LayerPanel() {
  const layers = useAtomValue(layersAtom);
  const views = useLayerViews();
  const move = useSetAtom(moveLayerAtom);
  const reset = useSetAtom(resetLayersAtom);
  const setExpanded = useSetAtom(expandedLayerAtom);
  const [dragging, setDragging] = useState<string | null>(null);
  const enter = useFluidTransition();
  const exit = useFluidTransition(EXIT_SECONDS);
  // A short travel before a pointer drag starts keeps a click on the grip from nudging the list.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (id: string | number) => {
    const view = views.find((v) => v.config.id === id);
    return view ? `${view.title} (${view.subtitle.toLowerCase()})` : "Layer";
  };
  const positionOf = (id: string | number) => layers.findIndex((l) => l.id === id) + 1;
  // dnd-kit reports the row over its own slot as soon as it is picked up. Announcing that would
  // replace "Picked up" before it is read, so a move is announced only when the slot changes.
  const announcedOver = useRef<string | number | null>(null);
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      announcedOver.current = active.id;
      return `Picked up ${nameOf(active.id)}, position ${positionOf(active.id)} of ${layers.length}.`;
    },
    onDragOver: ({ active, over }) => {
      if (!over || over.id === announcedOver.current) return undefined;
      announcedOver.current = over.id;
      return `${nameOf(active.id)} moved to position ${positionOf(over.id)} of ${layers.length}.`;
    },
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)} of ${layers.length}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };
  // Open settings fold away when a layer is picked up, so every row is one height and each arrow
  // key moves one place.
  const onDragStart = ({ active }: DragStartEvent) => {
    setDragging(String(active.id));
    setExpanded(null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (over && active.id !== over.id) move(String(active.id), String(over.id));
  };
  const draggedView = views.find((v) => v.config.id === dragging);

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Typography type="h6">Layers</Typography>
          <Typography type="body-xs" color="muted" id="layer-order-help">
            The top layer draws over the rest. Drag the grip to reorder.
          </Typography>
        </div>
        {layers.length > 0 && <AddLayerMenu />}
      </div>
      {layers.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          // Rows change height while folded settings close, so their positions are re-measured
          // throughout the drag.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "Press space or enter to pick up a layer. Use the arrow keys to move it, then space or enter to drop it, or escape to cancel.",
            },
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <SortableContext items={layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="-mx-2 grid grid-cols-1 gap-1" aria-label="Map layers">
              <AnimatePresence initial={false}>
                {views.map((view) => (
                  // A row clips only while it opens or closes. Clipping it at rest would cut off the
                  // row as it slides past its neighbours during a drag.
                  <motion.li
                    key={view.config.id}
                    initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                    animate={{
                      height: "auto",
                      opacity: 1,
                      transition: enter,
                      transitionEnd: { overflow: "visible" },
                    }}
                    exit={{ height: 0, opacity: 0, overflow: "hidden", transition: exit }}
                  >
                    <LayerCard view={view} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </SortableContext>
          {/* The dragged row travels as a lifted copy, so the list underneath can make room for it
              without the original row being clipped by its neighbours. The panel's backdrop blur
              would make it the copy's containing block and offset it from the pointer, so the copy
              renders on the page body. */}
          {createPortal(
            <DragOverlay
              className="layer-drag-copy"
              dropAnimation={{ duration: 250, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }}
            >
              {draggedView ? <LayerDragCopy view={draggedView} /> : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      ) : (
        <EmptyState className="flex flex-col items-center gap-2 py-6 text-center">
          <Layers size={22} className="text-muted" />
          <Typography type="h6">No layers on the map</Typography>
          <Typography type="body-sm" color="muted">
            Add schools, zones, areas or transport stops, then choose how each one is drawn.
          </Typography>
          <div className="mt-2">
            <AddLayerMenu variant="primary" />
          </div>
        </EmptyState>
      )}
      <Button size="sm" variant="ghost" className="w-full" onPress={reset}>
        <RotateCcw size={14} /> Reset layers
      </Button>
    </div>
  );
}
