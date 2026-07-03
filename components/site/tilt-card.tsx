"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";
import { useTilt } from "./hooks/use-tilt";
import { cn } from "@/lib/utils";

/**
 * A card that tilts toward the cursor in 3D space and reveals a glow
 * that follows the pointer. Used for Services + Values.
 */
export function TiltCard({
  children,
  className,
  glare = true,
  strength = 14,
}: {
  children: ReactNode;
  className?: string;
  glare?: boolean;
  strength?: number;
}) {
  const reduced = useReducedMotion();
  const { ref, tilt } = useTilt<HTMLDivElement>(strength);

  return (
    <motion.div
      ref={ref}
      style={
        reduced
          ? undefined
          : {
              rotateX: tilt.rx,
              rotateY: tilt.ry,
              transformPerspective: 900,
            }
      }
      whileHover={reduced ? undefined : { scale: 1.02 }}
      transition={{ type: "spring", stiffness: 250, damping: 18 }}
      className={cn(
        "group preserve-3d relative h-full overflow-hidden rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-brand/40 hover:bg-card/60",
        className,
      )}
    >
      {/* Pointer-follow glare */}
      {glare && !reduced && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(340px circle at var(--mx, 50%) var(--my, 50%), rgba(59, 130, 246, 0.22), transparent 60%)",
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
