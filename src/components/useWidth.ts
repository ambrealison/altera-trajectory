import { useLayoutEffect, useRef, useState } from "react";

/** Width of a container, kept up to date, so the SVG charts are drawn at their real size. */
export function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
