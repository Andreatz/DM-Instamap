import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "DM-Instamap",
  description: "Generatore modulare di mappe per D&D, locale e modulare."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="it">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
