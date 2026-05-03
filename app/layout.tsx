import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TrustLink",
  description: "Secure Escrow Protocol",
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
        </Providers>
        
        {/* The Toaster lives at the root so it can fire on any page */}
        <Toaster position="bottom-right" /> 
      </body>
    </html>
  );
}