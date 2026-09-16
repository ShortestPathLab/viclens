import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { EXIT_SECONDS, useFluidTransition } from "../transitions";

function Measured({
  onHeight,
  className,
  children,
}: {
  onHeight?: (height: number) => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();
  // The height asked for is the content's own, plus the padding of the box around it, which is
  // stretched to whatever height the panel currently has.
  useLayoutEffect(() => {
    const element = ref.current;
    const box = element?.parentElement;
    if (!onHeight || !element || !box || !isPresent) return;
    const report = () => {
      const style = getComputedStyle(box);
      onHeight(
        element.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
      );
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeight, isPresent]);
  // Content on its way out can still be seen for a moment, but not reached or read out.
  // `flow-root` keeps the children's margins inside the measured height.
  return (
    <div ref={ref} className={className ?? "flow-root"} inert={!isPresent || undefined}>
      {children}
    </div>
  );
}

/**
 * Content that changes with `id` inside a panel that stays open. The old content fades out as the
 * new fades in, rather than both cutting to nothing, which blinked when items were clicked through
 * quickly. With `fit`, the panel also eases to the new content's height instead of jumping to it;
 * the panel's own maximum height still caps it, and the box scrolls beyond that.
 *
 * The box around each version of the content gets `className`, so a scrolling box is recreated for
 * each item and opens at the top. `contentClassName` lays out the content inside it.
 */
export default function ContentTransition({
  id,
  fit = false,
  className,
  contentClassName,
  children,
}: {
  id: string;
  fit?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [height, setHeight] = useState<number | null>(null);
  const enter = useFluidTransition();
  const exit = useFluidTransition(EXIT_SECONDS);
  return (
    <motion.div
      className={`relative flex min-h-0 flex-col overflow-hidden ${fit ? "" : "flex-1"}`}
      initial={false}
      animate={fit && height !== null ? { height } : undefined}
      transition={enter}
    >
      {/* popLayout takes the outgoing content out of the flow, so the new content lays out in its
          place straight away while the old one fades on top. */}
      <AnimatePresence initial={false} mode="popLayout" anchorX="left">
        <motion.div
          key={id}
          className={`min-h-0 flex-1 ${className ?? ""}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: enter }}
          exit={{ opacity: 0, transition: exit }}
        >
          <Measured onHeight={fit ? setHeight : undefined} className={contentClassName}>
            {children}
          </Measured>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
