"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { PremiumButton } from "./premium-button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "Products", href: "#products" },
  { label: "About", href: "#about" },
  { label: "Academy", href: "#academy" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#home");

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Section spy
  useEffect(() => {
    const ids = navLinks.map((l) => l.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "py-2" : "py-4",
      )}
    >
      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX: progress }}
        className="absolute left-0 top-0 h-[2px] w-full origin-left bg-gradient-to-r from-brand via-cyan to-brand"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 sm:px-5",
            scrolled
              ? "glass-strong shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]"
              : "bg-transparent",
          )}
          aria-label="Main navigation"
        >
          {/* Logo */}
          <Link href="#home" className="group flex items-center gap-2.5" aria-label="TrustLink Home">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-300 group-hover:scale-105">
                <rect width="32" height="32" rx="9" fill="url(#tl-grad)" />
                <path d="M8 12L16 8L24 12V18C24 22.4183 20.4183 26 16 26C11.5817 26 8 22.4183 8 18V12Z" fill="rgba(255,255,255,0.18)" />
                <path d="M16 13V19M13 16H19" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="tl-grad" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="#3B82F6" />
                    <stop offset="1" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 -z-10 rounded-[9px] bg-brand/40 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-extrabold tracking-wide text-foreground">
                TRUST<span className="text-gradient">LINK</span>
              </span>
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Software Firm
              </span>
            </span>
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                    active === link.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active === link.href && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-brand to-cyan"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <PremiumButton href="#contact" size="sm" className="hidden sm:inline-flex">
              Get Started
            </PremiumButton>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-white/5 lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-navy-dark/80 backdrop-blur-xl"
              onClick={() => setOpen(false)}
            />
            <motion.ul
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ delay: 0.05 }}
              className="relative flex flex-col items-center justify-center gap-2 pt-28"
            >
              {navLinks.map((link, i) => (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-2xl font-semibold text-foreground/90 hover:text-gradient"
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
              <motion.li
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6"
              >
                <PremiumButton href="#contact" size="lg">
                  Get Started
                </PremiumButton>
              </motion.li>
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
