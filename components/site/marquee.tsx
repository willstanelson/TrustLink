"use client";

import { motion } from "framer-motion";

type MarqueeItem = {
  label: string;
  icon?: string;
};

const items: MarqueeItem[] = [
  { label: "Next.js" },
  { label: "TypeScript" },
  { label: "Escrow Engineering" },
  { label: "AI Video Generation" },
  { label: "Web3" },
  { label: "Solidity / EVM" },
  { label: "Real-time Systems" },
  { label: "Production SaaS" },
  { label: "Secure Transactions" },
  { label: "Cohort-Based Training" },
];

export function Marquee() {
  // Duplicate the list so the animation loops seamlessly
  const doubled = [...items, ...items];

  return (
    <section className="marquee-pause relative overflow-hidden border-y border-border/60 bg-navy-dark/40 py-5">
      {/* Edge fades */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent"
      />

      <div className="flex w-max animate-marquee items-center gap-8">
        {doubled.map((item, i) => (
          <motion.div
            key={`${item.label}-${i}`}
            className="flex items-center gap-3 whitespace-nowrap"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand to-cyan" />
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
