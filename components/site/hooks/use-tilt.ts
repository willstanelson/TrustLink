"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Tracks pointer position over an element and returns normalized (-0.5..0.5) coords
 * plus a flag for hover state. Used to drive 3D tilt + cursor spotlight.
 */
export function useTilt<T extends HTMLElement>(strength = 12) {
  const ref = useRef<T>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, hover: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      // Spotlight position for the glare (percent-based)
      el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTilt({
          rx: -y * strength, // rotateX (invert Y)
          ry: x * strength, // rotateY
          hover: true,
        });
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(raf);
      setTilt({ rx: 0, ry: 0, hover: false });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  return { ref, tilt };
}
