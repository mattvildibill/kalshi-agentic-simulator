import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Blue — Kalshi Paper Trading", template: "%s · Blue" },
  description:
    "Kalshi paper portfolio, research, and trade history. Simulated trades only.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
