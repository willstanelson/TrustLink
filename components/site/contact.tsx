"use client";

import { useState } from "react";
import { Mail, MessageCircle, MapPin, Clock, Send, CheckCircle2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeading } from "./section-heading";
import { AnimatedSection } from "./animated-section";
import { PremiumButton } from "./premium-button";
import { cn } from "@/lib/utils";

const contactInfo = [
  {
    icon: Mail,
    label: "Email",
    value: "tudor@trustlink.com.ng",
    href: "mailto:tudor@trustlink.com.ng",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "Chat with us",
    href: "https://wa.me/+2348162142147",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Remote · Nigeria",
    href: null,
  },
  {
    icon: Clock,
    label: "Working Hours",
    value: "Mon – Fri, 9AM – 6PM WAT",
    href: null,
  },
];

const subjectOptions = [
  "General Inquiry",
  "Software Project",
  "Web Development",
  "Academy",
  "Online Registration",
  "Partnership",
];

const faqItems = [
  {
    question: "How long does a typical project take?",
    answer:
      "It depends on scope. A landing page takes 1–2 weeks, while a full application can take 2–3 months.",
  },
  {
    question: "Do you work with clients outside Nigeria?",
    answer: "Absolutely. We work with clients globally.",
  },
  {
    question: "What's your pricing model?",
    answer:
      "We offer both fixed-price and milestone-based pricing. Contact us for a custom quote.",
  },
  {
    question: "Do you offer ongoing maintenance?",
    answer:
      "Yes. Every product we ship can be backed by a maintenance agreement covering updates, monitoring, and support.",
  },
];

export function Contact() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 4000);
  };

  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-aurora opacity-50"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          badge="Contact"
          title="Let's Talk"
          subtitle="Have a project in mind? Need a quote? Want to learn more about TrustLink? We'd love to hear from you."
        />

        <div className="mt-16 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Form */}
          <AnimatedSection>
            <form
              onSubmit={handleSubmit}
              className="relative overflow-hidden rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm sm:p-8"
            >
              <div
                aria-hidden
                className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand/10 blur-3xl"
              />
              <div className="relative">
                <h3 className="text-xl font-bold text-foreground">
                  Send us a message
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fill out the form and we&apos;ll get back to you within 24 hours.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="contact-name"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Name
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={handleChange}
                      autoComplete="name"
                      className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-brand/50 focus:bg-background/80 focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="contact-email"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Email
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                      className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-brand/50 focus:bg-background/80 focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <label
                    htmlFor="contact-subject"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm text-foreground outline-none transition-all duration-200 focus:border-brand/50 focus:bg-background/80 focus:ring-2 focus:ring-brand/20"
                  >
                    <option value="" disabled>
                      Select a subject
                    </option>
                    {subjectOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-navy">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 space-y-1.5">
                  <label
                    htmlFor="contact-message"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us about your project or question…"
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full resize-none rounded-xl border border-input bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground/60 focus:border-brand/50 focus:bg-background/80 focus:ring-2 focus:ring-brand/20"
                  />
                </div>

                <div className="mt-6">
                  <PremiumButton type="submit" size="lg" className="w-full sm:w-auto">
                    {submitted ? (
                      <>
                        <CheckCircle2 size={18} />
                        Message Sent
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send size={16} />
                      </>
                    )}
                  </PremiumButton>
                </div>

                {submitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
                  >
                    <CheckCircle2 size={16} />
                    Thanks! We&apos;ve received your message and will reply within 24 hours.
                  </motion.div>
                )}
              </div>
            </form>
          </AnimatedSection>

          {/* Info cards */}
          <AnimatedSection delay={0.15}>
            <div className="flex h-full flex-col gap-4">
              <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-foreground">
                  Contact Information
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reach out through any of these channels.
                </p>
                <div className="mt-5 space-y-3">
                  {contactInfo.map((item) => {
                    const Inner = (
                      <div className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all duration-200 hover:border-border hover:bg-white/[0.03]">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-110">
                          <item.icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    );
                    return item.href ? (
                      <a
                        key={item.label}
                        href={item.href}
                        target={item.href.startsWith("http") ? "_blank" : undefined}
                        rel={
                          item.href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                      >
                        {Inner}
                      </a>
                    ) : (
                      <div key={item.label}>{Inner}</div>
                    );
                  })}
                </div>
              </div>

              {/* Quick CTA */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand/10 via-cyan/5 to-transparent p-6 backdrop-blur-sm">
                <div
                  aria-hidden
                  className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand/20 blur-2xl"
                />
                <div className="relative">
                  <p className="text-sm font-semibold text-foreground">
                    Prefer to talk directly?
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Message us on WhatsApp for fastest response.
                  </p>
                  <a
                    href="https://wa.me/+2348162142147"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand transition-colors hover:text-cyan"
                  >
                    <MessageCircle size={16} />
                    +234 816 214 2147
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* FAQ */}
        <div className="mt-24">
          <SectionHeading
            badge="FAQ"
            title="Frequently Asked Questions"
            subtitle="Quick answers to common questions about working with us."
          />

          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {faqItems.map((item, index) => {
              const open = openFaq === index;
              return (
                <AnimatedSection key={index} delay={index * 0.06}>
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl border bg-card/40 backdrop-blur-sm transition-colors duration-200",
                      open ? "border-brand/40" : "border-border",
                    )}
                  >
                    <button
                      onClick={() => setOpenFaq(open ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-semibold text-foreground sm:text-base">
                        {item.question}
                      </span>
                      <ChevronDown
                        size={18}
                        className={cn(
                          "shrink-0 text-muted-foreground transition-transform duration-300",
                          open && "rotate-180 text-brand",
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                            {item.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
