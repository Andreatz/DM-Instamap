import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DM-Instamap",
  description: "Local-first modular map generator for D&D."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
