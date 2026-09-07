import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { siteOrigin } from "@/lib/site-url";
import "./globals.css";

const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "CaseDeck", template: "%s · CaseDeck" },
  description:
    "Case interview prep for ISB placements — case library, progress tracking, partner matching, and casebook downloads.",
  openGraph: {
    title: "CaseDeck",
    description: "Case interview prep for ISB placements.",
    siteName: "CaseDeck",
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
      <body className={`${ui.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
