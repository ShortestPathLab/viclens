import { useCallback, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useEnterAnimation, useExitAnimation } from "@react-aria/utils";

/**
 * Props that put a panel through its enter and exit animations. They carry the same
 * `data-entering` and `data-exiting` attributes HeroUI's popovers and drawers get from react-aria,
 * so a panel's motion is written in CSS against those attributes.
 */
export type TransitionProps = {
  ref: (element: HTMLElement | null) => void;
  "data-entering"?: true;
  "data-exiting"?: true;
  inert?: true;
};

function useElementRef() {
  const ref = useRef<HTMLElement | null>(null);
  const setRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);
  return [ref, setRef] as const;
}

/** Enter animation for a panel that is on screen from the moment it mounts. */
export function useEnterTransition(): TransitionProps {
  const [ref, setRef] = useElementRef();
  const isEntering = useEnterAnimation(ref);
  return { ref: setRef, "data-entering": isEntering || undefined };
}

function Entering<T>({
  value,
  elementRef,
  setRef,
  isExiting,
  children,
}: {
  value: T;
  elementRef: RefObject<HTMLElement | null>;
  setRef: TransitionProps["ref"];
  isExiting: boolean;
  children: (value: T, transition: TransitionProps) => ReactNode;
}) {
  const isEntering = useEnterAnimation(elementRef);
  return children(value, {
    ref: setRef,
    "data-entering": isEntering || undefined,
    "data-exiting": isExiting || undefined,
    // A closing panel can still be seen, but it can no longer be reached or read out.
    inert: isExiting || undefined,
  });
}

/**
 * Shows a panel while `value` is set, and keeps it mounted with the last value it held until its
 * exit animation has finished. This is the split react-aria's overlays use: the exit is tracked by
 * a parent that stays mounted, and the enter by a child that mounts afresh each time it opens.
 */
export default function Presence<T>({
  value,
  children,
}: {
  value: T | null | undefined | false | "";
  children: (value: T, transition: TransitionProps) => ReactNode;
}) {
  const [ref, setRef] = useElementRef();
  const isOpen = value !== null && value !== undefined && value !== false && value !== "";
  const isExiting = useExitAnimation(ref, isOpen);
  const [shown, setShown] = useState(value);
  if (isOpen && value !== shown) setShown(value);
  if (!isOpen && !isExiting) return null;
  return (
    <Entering
      value={(isOpen ? value : shown) as T}
      elementRef={ref}
      setRef={setRef}
      isExiting={isExiting}
    >
      {children}
    </Entering>
  );
}
