import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PrivyProvider } from '@privy-io/react-auth';
import { AuthProvider } from '@/context/AuthContext';
// ... other imports
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={{/* your config */}}>
          <AuthProvider>
             {/* WagmiProvider, QueryClientProvider, etc... */}
             {children}
          </AuthProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}