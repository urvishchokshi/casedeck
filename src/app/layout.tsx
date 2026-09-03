import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { siteOrigin } from "@/lib/site-url";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "Casedeck", template: "%s · Casedeck" },
  description:
    "Case interview prep for ISB placements — case library, progress tracking, partner matching, and casebook downloads.",
  openGraph: {
    title: "Casedeck",
    description: "Case interview prep for ISB placements.",
    siteName: "Casedeck",
    type: "website",
  },
  // Private ISB-only tool — keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${ui.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
