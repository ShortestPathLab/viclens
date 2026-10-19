import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { useAtom, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button as AriaButton } from "react-aria-components";
import { Button, Tooltip } from "@heroui/react";
import { ChevronDown, Eye, EyeOff, GripVertical } from "lucide-react";
import { expandedLayerAtom, updateLayerAtom } from "../../layers/state";
import type { LayerView } from "../../layers/useLayerViews";
import { EXIT_SECONDS, useFluidTransition } from "../../transitions";
import AutoHeight from "../AutoHeight";
import LayerGlyph from "./LayerGlyph";
import LayerSettings from "./LayerSettings";

interface Sortable {
  nodeRef?: Ref<HTMLDivElement>;
  handleRef?: Ref<HTMLButtonElement>;
  handleProps?: HTMLAttributes<HTMLButtonElement>;
  style?: CSSProperties;
  isDragging?: boolean;
  isOverlay?: boolean;
}

/**
 * One layer in the list. The row names the layer and what it shows; pressing it opens the settings
 * underneath. The grip drags it to a new place in the drawing order, by pointer or by keyboard.
 */
function LayerRow({
  view,
  nodeRef,
  handleRef,
  handleProps,
  style,
  isDragging,
  isOverlay,
}: Sortable & { view: LayerView }) {
  const { config, title, subtitle } = view;
  const [expandedId, setExpanded] = useAtom(expandedLayerAtom);
  const update = useSetAtom(updateLayerAtom);
  const enter = useFluidTransition();
  const exit = useFluidTransition(EXIT_SECONDS);
  const expanded = expandedId === config.id && !isOverlay;
  const panelId = `layer-settings-${config.id}`;
  const hidden = !config.visible;
  return (
    <div
      ref={nodeRef}
      style={style}
      className="layer-card rounded-xl"
      data-expanded={expanded || undefined}
      data-dragging={isDragging || undefined}
      data-overlay={isOverlay || undefined}
    >
      <div className="flex items-center gap-0.5 py-1 pr-1 pl-0.5">
        <button
          ref={handleRef}
          {...handleProps}
          type="button"
          aria-label={`Move ${title} layer`}
          aria-describedby="layer-order-help"
          className="layer-grip flex h-9 w-6 shrink-0 items-center justify-center rounded-md text-muted"
        >
          <GripVertical size={15} />
        </button>
        <AriaButton
          className="layer-trigger flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-1.5 text-start"
          aria-expanded={expanded}
          aria-controls={expanded ? panelId : undefined}
          onPress={() => setExpanded(expanded ? null : config.id)}
        >
          <LayerGlyph view={view} />
          <span
            className="flex min-w-0 flex-1 flex-col transition-opacity duration-200"
            style={{ opacity: hidden ? 0.55 : 1 }}
          >
            <span className="truncate text-sm font-medium">{title}</span>
            <span className="truncate text-xs text-muted">{subtitle}</span>
          </span>
          <ChevronDown
            size={15}
            aria-hidden="true"
            className="shrink-0 text-muted transition-transform duration-250 ease-out-fluid motion-reduce:transition-none"
            style={{ rotate: expanded ? "180deg" : "0deg" }}
          />
        </AriaButton>
        <Tooltip delay={600}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={`Show ${title} layer`}
            aria-pressed={!hidden}
            onPress={() => update(config.id, { visible: hidden })}
          >
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>
          <Tooltip.Content>{hidden ? "Show layer" : "Hide layer"}</Tooltip.Content>
        </Tooltip>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.section
            key="settings"
            id={panelId}
            aria-label={`${title} layer settings`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: enter }}
            exit={{ height: 0, opacity: 0, transition: exit }}
            style={{ overflow: "hidden" }}
          >
            <AutoHeight>
              <LayerSettings view={view} />
            </AutoHeight>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A row in the sortable list. Its place stays as a faint slot while a copy is dragged. */
export default function LayerCard({ view }: { view: LayerView }) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.config.id });
  return (
    <LayerRow
      view={view}
      nodeRef={setNodeRef}
      handleRef={setActivatorNodeRef}
      handleProps={{ ...attributes, ...listeners }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      isDragging={isDragging}
    />
  );
}
/** The lifted copy that follows the pointer during a drag. */
export const LayerDragCopy = ({ view }: { view: LayerView }) => <LayerRow view={view} isOverlay />;
