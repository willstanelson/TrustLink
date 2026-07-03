"use client";

import { ArrowRight } from "lucide-react";
import { AnimatedSection } from "./animated-section";
import { PremiumButton } from "./premium-button";

export function CtaBanner() {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AnimatedSection y={32}>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-navy-light via-navy to-navy-dark px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* Animated background */}
            <div
              aria-hidden
              className="animate-float-orb absolute -left-10 top-0 h-72 w-72 rounded-full bg-brand/15 blur-[100px]"
            />
            <div
              aria-hidden
              className="animate-float-orb animation-delay-2000 absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-cyan/12 blur-[100px]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-grid bg-grid-fade opacity-50"
            />

            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Let&apos;s Build Something{" "}
                <span className="text-gradient">Together</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Whether you need a bespoke web app, a secure escrow pipeline, or
                a full software product — our team is ready to deliver.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PremiumButton href="#contact" size="lg" className="w-full sm:w-auto">
                  Start a Project
                  <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                </PremiumButton>
                <PremiumButton href="#about" variant="outline" size="lg" className="w-full sm:w-auto">
                  Learn About Us
                </PremiumButton>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
