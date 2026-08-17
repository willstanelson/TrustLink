import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import "./globals.css";
import Providers from "./providers";
import ChatbotWidget from "@/components/ChatbotWidget";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://trustlink.com.ng'),
  title: "TrustLink | Software Firm & Secure Escrow Protocol",
  description: "TrustLink Software Firm (CAC 9499334) — Trust is no longer a leap of faith. Building, shipping, and maintaining high-trust software solutions.",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/icon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/icon-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
      { url: '/apple-icon.png', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: "TrustLink Software Firm",
    description: "Trust is no longer a leap of faith. CAC Registration: 9499334.",
    images: [{ url: '/logo.png', width: 483, height: 194, alt: 'TrustLink Software Firm' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Your Auth and Context Providers wrap the app */}
        <Providers>
          {children}
          <ChatbotWidget />
        </Providers>
        
        {/* The Toaster lives at the root so it can fire on any page */}
        <Toaster position="bottom-right" /> 
      </body>
    </html>
  );
}