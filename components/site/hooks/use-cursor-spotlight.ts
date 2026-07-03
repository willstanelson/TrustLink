"use client";

import { useEffect } from "react";

/**
 * Sets --mx / --my CSS custom properties on a target element based on pointer
 * position, enabling a pure-CSS cursor spotlight via the .cursor-spotlight utility.
 */
export function useCursorSpotlight<T extends HTMLElement>() {
  useEffect(() => {
    const el = document.querySelector<T>("[data-spotlight]");
    if (!el) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${x}%`);
        el.style.setProperty("--my", `${y}%`);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
