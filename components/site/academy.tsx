"use client";

import { Brain, Hammer, Target, Clock, ArrowRight } from "lucide-react";
import { AnimatedSection, StaggerGroup, StaggerItem } from "./animated-section";
import { PremiumButton } from "./premium-button";

const differentiators = [
  {
    icon: Hammer,
    title: "Built by Builders",
    description:
      "Taught by engineers actively shipping production software, not career instructors.",
  },
  {
    icon: Target,
    title: "Performance-Vetted",
    description:
      "No paid seat is purchased for a student who hasn't first proven they can code.",
  },
  {
    icon: Clock,
    title: "Deadline-Enforced",
    description:
      "Fixed cohorts with clear start and end dates. No open-ended subscriptions.",
  },
  {
    icon: Brain,
    title: "AI-Augmented",
    description:
      "Prompt engineering taught last, not first — AI is a multiplier on judgment, not a substitute.",
  },
];

export function Academy() {
  return (
    <section id="academy" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Hero card with animated gradient border */}
        <AnimatedSection y={36}>
          <div className="relative overflow-hidden rounded-3xl">
            {/* Animated gradient border */}
            <div
              aria-hidden
              className="animate-gradient-shift absolute inset-0 rounded-3xl bg-gradient-to-r from-brand via-cyan to-brand p-px"
              style={{
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
            <div className="relative overflow-hidden rounded-3xl bg-navy-dark/90 backdrop-blur-xl">
              {/* Inner glow orbs */}
              <div
                aria-hidden
                className="animate-float-orb absolute -left-10 top-0 h-64 w-64 rounded-full bg-brand/15 blur-[80px]"
              />
              <div
                aria-hidden
                className="animate-float-orb animation-delay-2000 absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-cyan/12 blur-[80px]"
              />

              <div className="relative px-6 py-12 sm:px-12 sm:py-16">
                <div className="text-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-dot" />
                    Coming Soon
                  </span>
                  <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                    TrustLink <span className="text-gradient">Academy</span>
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-base italic text-brand sm:text-lg">
                    Learn to Build, Not Just to Code
                  </p>
                  <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    A high-touch, cohort-based, deadline-enforced engineering
                    finishing school run by the active builders who ship
                    TrustLink&apos;s production software. No pre-recorded
                    lectures. No open-ended subscriptions. Just real engineering,
                    real deadlines, and real results.
                  </p>
                </div>

                {/* Differentiators grid */}
                <StaggerGroup
                  stagger={0.1}
                  className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {differentiators.map((d) => (
                    <StaggerItem key={d.title}>
                      <div className="group h-full rounded-xl border border-border bg-white/[0.03] p-5 transition-all duration-300 hover:border-brand/40 hover:bg-white/[0.06]">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                          <d.icon size={20} />
                        </div>
                        <h3 className="mb-1.5 text-sm font-bold text-foreground">
                          {d.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {d.description}
                        </p>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerGroup>

                {/* AI bridge callout */}
                <div className="mt-8 rounded-2xl border border-cyan/20 bg-cyan/[0.04] p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan">
                    <Brain size={14} />
                    Phase 3: The AI-Augmented Engineering Bridge
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-snug text-foreground">
                    AI is a multiplier on engineering judgment, not a substitute.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    After capstone completion, graduates use AI assistants to
                    extend their systems — then write a detailed architectural
                    defense explaining what AI did right, where it failed, and
                    how they resolved the failure.
                  </p>
                </div>

                <div className="mt-10 text-center">
                  <PremiumButton href="#contact" variant="outline" size="lg">
                    Join the Waitlist
                    <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </PremiumButton>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
