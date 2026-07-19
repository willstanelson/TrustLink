"use client";

import Link from "next/link";
import { Mail, MessageCircle, ArrowUpRight } from "lucide-react";

const footerLinks = [
  {
    title: "Company",
    links: [
      { label: "About Us", href: "#about" },
      { label: "Services", href: "#services" },
      { label: "Products", href: "#products" },
      { label: "Academy", href: "#academy" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Software Development", href: "#services" },
      { label: "Web Development", href: "#services" },
      { label: "Escrow & Exchange", href: "#products" },
      { label: "Online Registrations", href: "#services" },
      { label: "Training Academy", href: "#academy" },
    ],
  },
  {
    title: "Products",
    links: [
      { label: "TrustLink Escrow", href: "https://macqet.trustlink.com.ng/escrow", external: true },
      { label: "DiipMynd AI Video", href: "https://diipmynd.trustlink.com.ng", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-border bg-navy-dark/80">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-brand/8 blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="flex flex-col gap-5">
            <Link href="#home" className="group flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="9" fill="url(#tl-grad-f)" />
                  <path d="M8 12L16 8L24 12V18C24 22.4183 20.4183 26 16 26C11.5817 26 8 22.4183 8 18V12Z" fill="rgba(255,255,255,0.18)" />
                  <path d="M16 13V19M13 16H19" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="tl-grad-f" x1="0" y1="0" x2="32" y2="32">
                      <stop stopColor="#3B82F6" />
                      <stop offset="1" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
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

            <p className="max-w-xs text-sm italic leading-relaxed text-muted-foreground">
              &ldquo;Trust is no longer a leap of faith.&rdquo;
            </p>

            <div className="space-y-2">
              <a
                href="mailto:tudor@trustlink.com.ng"
                className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-brand"
              >
                <Mail size={15} className="text-muted-foreground transition-colors group-hover:text-brand" />
                tudor@trustlink.com.ng
              </a>
              <a
                href="https://wa.me/+2348162142147"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-brand"
              >
                <MessageCircle size={15} className="text-muted-foreground transition-colors group-hover:text-brand" />
                +234 816 214 2147
              </a>
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.title} className="flex flex-col gap-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...(("external" in link && link.external)
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                      {("external" in link && link.external) && (
                        <ArrowUpRight
                          size={13}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-10 h-px bg-border" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TrustLink Software Firm. CAC Reg: 9499334.
            All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
