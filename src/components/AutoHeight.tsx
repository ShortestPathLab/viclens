import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useFluidTransition } from "../transitions";

/**
 * A box that eases to the height of its content whenever the content grows or shrinks, instead of
 * jumping. It clips only while it moves, so focus rings at its edges show once it settles.
 */
export default function AutoHeight({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [moving, setMoving] = useState(false);
  const transition = useFluidTransition();
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={transition}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
      style={{ overflow: moving ? "hidden" : "visible" }}
    >
      <div ref={content} className="flow-root">
        {children}
      </div>
    </motion.div>
  );
}
