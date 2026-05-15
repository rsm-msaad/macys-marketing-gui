import type { Metadata } from "next";
import "./globals.css";

import { PersonaProvider } from "@/components/PersonaContext";

export const metadata: Metadata = {
  title: "Macy's Marketing Operations",
  description: "AI powered campaign workflow for marketing teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800&family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-cream text-charcoal font-body antialiased">
        <PersonaProvider>{children}</PersonaProvider>
      </body>
    </html>
  );
}
