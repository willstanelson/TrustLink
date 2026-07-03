import { Navbar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import { TrustSignals } from "@/components/site/trust-signals";
import { Marquee } from "@/components/site/marquee";
import { Services } from "@/components/site/services";
import { Products } from "@/components/site/products";
import { About } from "@/components/site/about";
import { Academy } from "@/components/site/academy";
import { CtaBanner } from "@/components/site/cta-banner";
import { Contact } from "@/components/site/contact";
import { Footer } from "@/components/site/footer";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <TrustSignals />
        <Marquee />
        <Services />
        <Products />
        <About />
        <Academy />
        <CtaBanner />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}