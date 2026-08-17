"use client";

import Link from "next/link";
import Image from "next/image";
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
            <Link href="#home" className="group inline-flex items-center" aria-label="TrustLink Home">
              <Image
                src="/logo.png"
                alt="TrustLink Software Firm"
                width={483}
                height={194}
                className="h-14 sm:h-16 md:h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
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
