import { useRef, type MutableRefObject } from "react";

/** A ref that always holds the value from the latest render: for callbacks and effects that must not re-subscribe. */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
