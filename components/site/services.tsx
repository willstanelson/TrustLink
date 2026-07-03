"use client";

import { Code2, Globe, FileCheck, ShoppingCart, ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { StaggerGroup, StaggerItem } from "./animated-section";
import { TiltCard } from "./tilt-card";
import { cn } from "@/lib/utils";

const services = [
  {
    icon: Code2,
    title: "Software Development",
    description:
      "Custom software solutions engineered from the ground up to solve complex business problems — full-stack apps, APIs, and internal tooling.",
    accent: "from-brand/25 to-brand/5",
    tags: ["Full-stack apps", "APIs", "Internal tooling"],
  },
  {
    icon: Globe,
    title: "Web Development",
    description:
      "Responsive, performant websites and web applications built with modern, fast frameworks — optimized for speed, SEO, and conversion.",
    accent: "from-cyan/25 to-cyan/5",
    tags: ["Next.js", "Landing pages", "Web apps"],
  },
  {
    icon: FileCheck,
    title: "Online Services",
    description:
      "Quick, hassle-free registrations for JAMB, Post UTME, NYSC, and other digital portals — handled end-to-end so you don't have to.",
    accent: "from-success/25 to-success/5",
    tags: ["JAMB", "Post UTME", "NYSC"],
  },
  {
    icon: ShoppingCart,
    title: "Escrow & Exchange",
    description:
      "Secure, escrow-protected transactions for crypto, gift cards, and fiat currency — eliminating fraud risk in peer-to-peer exchange.",
    accent: "from-warning/25 to-warning/5",
    tags: ["Crypto", "Gift cards", "Fiat"],
  },
];

export function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          badge="Services"
          title="What We Do"
          subtitle="Reliable software engineering and digital solutions tailored to your unique requirements — built by active engineers, not career instructors."
        />

        <StaggerGroup
          stagger={0.1}
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {services.map((s) => (
            <StaggerItem key={s.title} className="h-full">
              <TiltCard className="h-full" strength={15}>
                {/* Hover glow */}
                <div
                  aria-hidden
                  className={cn(
                    "absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
                    s.accent,
                  )}
                />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-foreground shadow-glow-soft"
                  style={{}}
                >
                  <span className={cn("flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br", s.accent)}>
                    <s.icon size={24} />
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">
                  {s.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-border bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <ArrowUpRight
                  size={18}
                  className="absolute right-5 top-5 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:text-brand"
                />
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
