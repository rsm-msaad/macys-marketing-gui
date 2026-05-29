import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

import { PersonaProvider } from "@/components/PersonaContext";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Macy's Marketing Operations",
  description: "Internal marketing operations console for the May 7 demo.",
  other: {
    "theme-color": "#F8F4EC",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${inter.variable} min-h-screen bg-cream text-charcoal antialiased`}
      >
        <PersonaProvider>{children}</PersonaProvider>
      </body>
    </html>
  );
}
