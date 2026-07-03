"use client";

import { Award, Shield, Lightbulb, Handshake, Target, Eye, Layers, Building2, GraduationCap } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { AnimatedSection, StaggerGroup, StaggerItem } from "./animated-section";
import { TiltCard } from "./tilt-card";
import { cn } from "@/lib/utils";

const stats = [
  { value: "2+", label: "Flagship Products" },
  { value: "3", label: "Service Lines" },
  { value: "CAC", label: "9499334" },
];

const serviceLines = [
  { icon: Layers, label: "Apps & Websites" },
  { icon: Building2, label: "Trading & Exchange" },
  { icon: GraduationCap, label: "Training Academy" },
];

const values = [
  {
    icon: Award,
    title: "Quality",
    description:
      "Every line of code is intentional. No shortcuts, no templates, no vibecoded outputs.",
  },
  {
    icon: Shield,
    title: "Security",
    description:
      "From escrow transactions to user data, security is engineered in, not bolted on.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description:
      "We stay at the frontier — AI video generation, Web3, and beyond.",
  },
  {
    icon: Handshake,
    title: "Trust",
    description:
      "Trust is no longer a leap of faith. We prove it with every product we ship.",
  },
];

export function About() {
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Story */}
        <SectionHeading
          badge="About TrustLink"
          title="Built by Builders"
          subtitle="TrustLink Software Firm is a registered Nigerian software company (CAC 9499334) that builds, ships, and maintains software for individuals, businesses, and corporate entities."
        />

        <div className="mt-16 grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Narrative */}
          <AnimatedSection>
            <div className="space-y-5">
              <h3 className="text-2xl font-bold text-foreground sm:text-3xl">
                From Vision to Production
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                TrustLink Software Firm was founded with one conviction:{" "}
                <span className="font-semibold text-foreground">
                  Nigerian tech firms can deliver world-class software
                </span>
                . Not tomorrow — today.
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                We operate across three strategic service lines. Our{" "}
                <strong className="font-semibold text-foreground">
                  Apps &amp; Websites
                </strong>{" "}
                division builds custom software for businesses and individuals.
                Our{" "}
                <strong className="font-semibold text-foreground">
                  Trading &amp; Exchange
                </strong>{" "}
                service line powers secure escrow transactions for crypto, gift
                cards, and fiat. And our{" "}
                <strong className="font-semibold text-foreground">
                  Training Academy
                </strong>{" "}
                is being built to develop the next generation of Nigerian
                engineers.
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                Every product we ship is engineered by active builders who
                understand production systems. We don&apos;t outsource our
                thinking. We don&apos;t template our solutions. We write
                intentional code that solves real problems — and we stand behind
                every line of it.
              </p>
            </div>
          </AnimatedSection>

          {/* Stats + service lines */}
          <AnimatedSection delay={0.15}>
            <div className="grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="group rounded-xl border border-border bg-card/40 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:bg-card/60"
                >
                  <p className="text-2xl font-extrabold text-gradient sm:text-3xl">
                    {s.value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Service Lines
              </h4>
              <div className="space-y-3">
                {serviceLines.map((sl) => (
                  <div
                    key={sl.label}
                    className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand transition-all duration-300 group-hover:scale-110">
                      <sl.icon size={18} />
                    </div>
                    <span className="text-sm font-medium text-foreground/90">
                      {sl.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Mission & Vision */}
        <div className="mt-24">
          <AnimatedSection>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand/10 via-card/40 to-card/40 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/15 blur-3xl"
                />
                <div className="relative">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand">
                    <Target size={24} />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-foreground">
                    Our Mission
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    To deliver reliable, secure, and scalable software that
                    businesses can depend on — engineered by active builders who
                    ship real production systems.
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cyan/10 via-card/40 to-card/40 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan/40">
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan/15 blur-3xl"
                />
                <div className="relative">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
                    <Eye size={24} />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-foreground">
                    Our Vision
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    To become the most trusted software firm in Nigeria, setting
                    the standard for quality, transparency, and technical
                    excellence.
                  </p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Values */}
        <div className="mt-24">
          <SectionHeading
            badge="What We Stand For"
            title="Our Values"
            subtitle="The principles that guide every decision, every product, and every line of code."
          />

          <StaggerGroup
            stagger={0.1}
            className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {values.map((v) => (
              <StaggerItem key={v.title} className="h-full">
                <TiltCard className="h-full" strength={16}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110 group-hover:shadow-glow">
                    <v.icon size={22} />
                  </div>
                  <h4 className="mb-2 text-base font-bold text-foreground">
                    {v.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {v.description}
                  </p>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
