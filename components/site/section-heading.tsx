"use client";

import { AnimatedSection } from "./animated-section";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
};

export function SectionHeading({
  badge,
  title,
  subtitle,
  centered = true,
  className,
}: SectionHeadingProps) {
  return (
    <AnimatedSection
      className={cn(
        "flex flex-col gap-4",
        centered && "items-center text-center",
        className,
      )}
    >
      {badge && (
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse-dot" />
          {badge}
        </span>
      )}
      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "text-base leading-relaxed text-muted-foreground sm:text-lg",
            centered && "mx-auto max-w-2xl",
          )}
        >
          {subtitle}
        </p>
      )}
    </AnimatedSection>
  );
}
