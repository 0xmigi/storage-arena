import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storage Arena — Tapedrive vs Walrus vs IPFS vs S3",
  description:
    "Send one file to four storage networks at once and watch how each handles it — or replay the averaged runs. A minimal, educational look at decentralized vs centralized storage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
