"use client";

import { Package, ShieldCheck, Users, Building2 } from "lucide-react";
import { StaggerGroup, StaggerItem } from "./animated-section";
import { useCountUp } from "./hooks/use-count-up";

type Signal = {
  icon: typeof Package;
  value: string;
  label: string;
};

function StatValue({ value }: { value: string }) {
  const { ref, display } = useCountUp(value, 1800);
  return (
    <span ref={ref} className="truncate text-base font-bold text-foreground sm:text-lg">
      {display}
    </span>
  );
}

const signals: Signal[] = [
  { icon: Package, value: "2", label: "Flagship Products · Shipped & Live" },
  { icon: ShieldCheck, value: "9499334", label: "CAC Registration Number" },
  { icon: Users, value: "3", label: "Service Lines · Apps · Exchange · Academy" },
  { icon: Building2, value: "100", label: "% Nigerian-Built, Production-Ready" },
];

export function TrustSignals() {
  return (
    <section className="relative border-y border-border/60 bg-navy-light/30">
      <StaggerGroup
        stagger={0.1}
        className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-4 py-3 sm:px-6 lg:grid-cols-4"
      >
        {signals.map((s) => (
          <StaggerItem
            key={s.label}
            className="group flex items-center gap-4 px-4 py-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand transition-all duration-300 group-hover:scale-110 group-hover:border-brand/50 group-hover:shadow-glow">
              <s.icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground sm:text-lg">
                <StatValue value={s.value} />
              </p>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {s.label}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
