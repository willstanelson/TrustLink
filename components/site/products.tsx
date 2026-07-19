"use client";

import { CheckCircle, ArrowUpRight, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeading } from "./section-heading";
import { AnimatedSection } from "./animated-section";
import { PremiumButton } from "./premium-button";
import { cn } from "@/lib/utils";

type Product = {
  badge: string;
  title: string;
  tagline: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  icon: typeof Shield;
  accent: string;
  glow: string;
  reversed?: boolean;
};

const products: Product[] = [
  {
    badge: "LIVE",
    title: "TrustLink Escrow",
    tagline: "Secure transaction infrastructure",
    description:
      "Secure digital transactions with built-in escrow protection. We hold payments securely in escrow until both parties fulfill their commitments — eliminating fraud risk and bringing transparency to peer-to-peer exchange.",
    features: [
      "Escrow-protected transactions",
      "Automated payout on milestone completion",
      "Built-in dispute resolution system",
      "Multi-party escrow support",
      "Real-time transaction tracking & alerts",
    ],
    ctaText: "Launch Escrow",
    ctaHref: "https://macqet.trustlink.com.ng/escrow",
    icon: Shield,
    accent: "from-brand/25 to-brand/5",
    glow: "shadow-glow",
  },
  {
    badge: "LIVE",
    title: "DiipMynd",
    tagline: "AI video generation, reimagined",
    description:
      "Transform text and images into stunning high-definition videos using state-of-the-art AI. Powered by Decart's Lucy AI video model, DiipMynd is optimized for content creators, streamers, and marketing professionals looking for studio-grade content in seconds.",
    features: [
      "AI text-to-video generation",
      "Image-to-video transformation",
      "Powered by Decart Lucy AI model",
      "Built for creators & digital agencies",
      "Ultra-fast render & download pipelines",
    ],
    ctaText: "Try DiipMynd",
    ctaHref: "https://diipmynd.trustlink.com.ng",
    icon: Sparkles,
    accent: "from-cyan/25 to-cyan/5",
    glow: "shadow-glow-cyan",
    reversed: true,
  },
];

function ProductCard({ product }: { product: Product }) {
  return (
    <AnimatedSection
      y={36}
      className={cn(
        "relative grid items-center gap-8 lg:grid-cols-2 lg:gap-14",
        product.reversed && "lg:[&>div:first-child]:order-2",
      )}
    >
      {/* Content */}
      <div className="flex flex-col">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
            {product.badge}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {product.tagline}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-foreground",
              product.accent,
            )}
          >
            <product.icon size={24} />
          </div>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {product.title}
          </h3>
        </div>

        <p className="mb-6 text-base leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <ul className="mb-8 space-y-3">
          {product.features.map((f) => (
            <li key={f} className="flex items-center gap-3 text-sm text-foreground/90">
              <CheckCircle size={18} className="shrink-0 text-success" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div>
          <PremiumButton href={product.ctaHref} external size="md">
            {product.ctaText}
            <ArrowUpRight size={16} />
          </PremiumButton>
        </div>
      </div>

      {/* Visual */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="group relative"
      >
        <div
          aria-hidden
          className={cn(
            "absolute -inset-4 rounded-3xl bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40",
            product.accent,
          )}
        />
        <div
          className={cn(
            "relative aspect-[16/11] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-navy-light to-navy p-8",
            product.glow,
            "transition-transform duration-500 group-hover:-translate-y-1",
          )}
        >
          {/* Browser chrome mockup */}
          <div className="mb-5 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-error/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
            <span className="ml-3 h-5 flex-1 rounded-md bg-white/5" />
          </div>

          {/* Mock dashboard content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-foreground",
                    product.accent,
                  )}
                >
                  <product.icon size={16} />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-20 rounded bg-white/15" />
                  <div className="h-1.5 w-14 rounded bg-white/8" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-md bg-gradient-to-r from-brand/30 to-cyan/30" />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-white/[0.03] p-3"
                >
                  <div className="mb-2 h-1.5 w-8 rounded bg-white/10" />
                  <div className="h-3 w-12 rounded bg-white/20" />
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] p-2.5"
                >
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand/40 to-cyan/40" />
                  <div className="flex-1 space-y-1">
                    <div className="h-1.5 w-24 rounded bg-white/15" />
                    <div className="h-1.5 w-16 rounded bg-white/8" />
                  </div>
                  <div className="h-4 w-12 rounded bg-gradient-to-r from-success/30 to-success/10" />
                </div>
              ))}
            </div>
          </div>

          {/* Shine sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="animate-shimmer absolute inset-0" />
          </div>
        </div>
      </motion.div>
    </AnimatedSection>
  );
}

export function Products() {
  return (
    <section
      id="products"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-aurora opacity-60"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          badge="Our Products"
          title="Flagship Software Solutions"
          subtitle="Explore the live production platforms built and operated by our firm — trusted by real users every day."
        />

        <div className="mt-16 flex flex-col gap-24 lg:gap-32">
          {products.map((p) => (
            <ProductCard key={p.title} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
