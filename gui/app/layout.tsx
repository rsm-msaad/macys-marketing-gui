import type { Metadata } from "next";
import "./globals.css";

import { PersonaProvider } from "@/components/PersonaContext";

export const metadata: Metadata = {
  title: "Macy's Marketing Operations",
  description: "Internal marketing operations console for the May 7 demo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-charcoal">
        <PersonaProvider>{children}</PersonaProvider>
      </body>
    </html>
  );
}
