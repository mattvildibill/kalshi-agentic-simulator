import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Blue — Prediction Research", template: "%s · Blue" },
  description:
    "A public research journal and $100,000 paper-trading experiment. Evidence, independent challenge, and transparent outcomes. No real money.",
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
