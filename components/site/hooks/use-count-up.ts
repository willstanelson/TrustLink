"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

/**
 * Animates a number from 0 → target when the element scrolls into view.
 * Supports numeric targets (extracts first integer/float from the input string).
 */
export function useCountUp(rawTarget: string, duration = 1800) {
  const target = parseFloat(rawTarget.replace(/[^0-9.]/g, ""));
  const suffix = rawTarget.replace(/[0-9.]/g, "");

  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView || isNaN(target)) {
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // easeOutExpo for a satisfying settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  const display =
    isNaN(target) || target === 0
      ? rawTarget
      : Number.isInteger(target)
        ? `${Math.round(value)}${suffix}`
        : `${value.toFixed(1)}${suffix}`;

  return { ref, display };
}
