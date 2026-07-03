"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "text-white border border-transparent shadow-[0_8px_30px_-8px_rgba(59,130,246,0.55)] hover:shadow-[0_14px_44px_-8px_rgba(59,130,246,0.75)]",
  outline:
    "text-foreground bg-white/[0.02] border border-border hover:border-brand/50 hover:bg-white/[0.05] backdrop-blur-sm",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-13 px-8 text-base",
};

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonAsButton = CommonProps & {
  href?: undefined;
  type?: "button" | "submit";
  onClick?: () => void;
};

type ButtonAsLink = CommonProps & {
  href: string;
  external?: boolean;
};

type PremiumButtonProps = ButtonAsButton | ButtonAsLink;

export function PremiumButton(props: PremiumButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    className,
  } = props;

  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  // Track pointer within the button for the liquid fill origin
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const springX = useSpring(mx, { stiffness: 220, damping: 22 });
  const springY = useSpring(my, { stiffness: 220, damping: 22 });

  // Magnetic pull
  const pullX = useMotionValue(0);
  const pullY = useMotionValue(0);
  const springPullX = useSpring(pullX, { stiffness: 260, damping: 18 });
  const springPullY = useSpring(pullY, { stiffness: 260, damping: 18 });

  const handleMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    mx.set(px);
    my.set(py);
    // magnetic pull (subtle)
    pullX.set((e.clientX - rect.left - rect.width / 2) * 0.2);
    pullY.set((e.clientY - rect.top - rect.height / 2) * 0.35);
  };

  const reset = () => {
    mx.set(50);
    my.set(50);
    pullX.set(0);
    pullY.set(0);
    setHovered(false);
  };

  const inner = (
    <motion.span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      onMouseEnter={() => setHovered(true)}
      style={{ x: springPullX, y: springPullY }}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold transition-colors duration-300 select-none cursor-pointer",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
    >
      {/* Liquid gradient fill (primary only) — expands from cursor on hover */}
      {variant === "primary" && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), #60A5FA 0%, #3B82F6 35%, #0891B2 100%)",
          }}
          animate={{
            opacity: hovered ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Border-trace sweep (outline only) — a light sheen runs around the border */}
      {variant === "outline" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-xl"
        >
          <span
            className={cn(
              "absolute -inset-y-4 -left-1/4 w-1/4 rotate-12 bg-gradient-to-r from-transparent via-brand/30 to-transparent transition-transform duration-700 ease-out",
              hovered ? "translate-x-[500%]" : "translate-x-0",
            )}
          />
        </span>
      )}

      {/* Top sheen */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-xl",
        )}
      >
        <span
          className={cn(
            "absolute -inset-y-2 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700",
            hovered ? "translate-x-[420%]" : "translate-x-0",
          )}
        />
      </span>

      {/* Content */}
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>

      {/* Inner ring highlight for primary */}
      {variant === "primary" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 rounded-xl ring-1 ring-inset ring-white/15"
        />
      )}
    </motion.span>
  );

  // Apply CSS vars from spring for the liquid fill position (in effect, not render)
  useEffect(() => {
    const unsubX = springX.on("change", (v) => {
      if (ref.current) ref.current.style.setProperty("--mx", `${v}%`);
    });
    const unsubY = springY.on("change", (v) => {
      if (ref.current) ref.current.style.setProperty("--my", `${v}%`);
    });
    return () => {
      unsubX();
      unsubY();
    };
  }, [springX, springY]);

  if ("href" in props && props.href) {
    if (props.external) {
      return (
        <a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={props.href} className="inline-block">
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={(props as ButtonAsButton).type ?? "button"}
      onClick={(props as ButtonAsButton).onClick}
      className="inline-block bg-transparent p-0 border-0"
    >
      {inner}
    </button>
  );
}
