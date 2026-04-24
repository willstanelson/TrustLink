import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 🚀 THE FIX: Import the consolidated client Providers file
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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}