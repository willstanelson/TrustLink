"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { PremiumButton } from "./premium-button";
import { useCursorSpotlight } from "./hooks/use-cursor-spotlight";

export function Hero() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Parallax: orbs drift at different rates as you scroll the hero away
  const orb1Y = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const orb2Y = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const orb3Y = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useCursorSpotlight<HTMLDivElement>();

  return (
    <section
      ref={sectionRef}
      id="home"
      data-spotlight
      className="cursor-spotlight relative flex min-h-[100svh] items-center justify-center overflow-hidden pt-28 pb-20"
    >
      {/* Animated aurora mesh */}
      <div className="bg-aurora-mesh absolute inset-0 -z-10" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-grid bg-grid-fade"
        aria-hidden
      />

      {/* Floating orbs with parallax */}
      {!reduced && (
        <>
          <motion.div
            aria-hidden
            style={{ y: orb1Y }}
            className="animate-float-orb absolute -right-10 top-10 h-[440px] w-[440px] rounded-full bg-brand/14 blur-[110px]"
          />
          <motion.div
            aria-hidden
            style={{ y: orb2Y }}
            className="animate-float-orb animation-delay-2000 absolute -left-10 bottom-10 h-[360px] w-[360px] rounded-full bg-cyan/12 blur-[100px]"
          />
          <motion.div
            aria-hidden
            style={{ y: orb3Y }}
            className="animate-float-orb animation-delay-4000 absolute left-1/3 top-1/4 h-[220px] w-[220px] rounded-full bg-brand-bright/10 blur-[80px]"
          />
        </>
      )}

      <motion.div
        style={{ y: reduced ? 0 : contentY, opacity: reduced ? 1 : contentOpacity }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="glass mb-8 inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-sm font-medium text-foreground/90"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Registered Nigerian Software Firm
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">CAC 9499334</span>
        </motion.div>

        {/* Title with spotlight-reveal mask wipe */}
        <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
          <motion.span
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="block"
          >
            We Build Software
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="text-gradient block"
          >
            That Works.
          </motion.span>
        </h1>

        {/* Motto */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 flex items-center justify-center gap-3"
        >
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="h-px w-8 origin-left bg-gradient-to-r from-transparent to-brand"
          />
          <p className="text-lg font-medium italic text-brand sm:text-xl">
            Trust is no longer a leap of faith.
          </p>
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="h-px w-8 origin-right bg-gradient-to-l from-transparent to-cyan"
          />
        </motion.div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          From secure escrow platforms to AI-powered video tools — we build, ship,
          and maintain software that individuals and businesses across Nigeria and
          beyond can depend on.
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <PremiumButton href="#contact" size="lg" className="w-full sm:w-auto">
            Start a Project
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </PremiumButton>
          <PremiumButton href="#products" variant="outline" size="lg" className="w-full sm:w-auto">
            View Our Products
          </PremiumButton>
        </motion.div>

        {/* Mini trust row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={16} className="text-success" />
            Escrow-secured
          </span>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="inline-flex items-center gap-2">
            <Sparkles size={16} className="text-cyan" />
            AI-native products
          </span>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning" />
            CAC registered
          </span>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex h-9 w-5.5 items-start justify-center rounded-full border border-border p-1.5">
          <motion.span
            animate={{ y: [0, 10, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="h-1.5 w-1 rounded-full bg-gradient-to-b from-brand to-cyan"
          />
        </div>
      </motion.div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background"
      />
    </section>
  );
}
