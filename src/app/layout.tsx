import type { Metadata } from "next";
import "./globals.css";
import { ErrorLogger } from "@/components/ErrorLogger";

export const metadata: Metadata = {
  title: "Store Orders",
  description: "Order, billing, and ledger management over WhatsApp & Telegram",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface">
        <ErrorLogger />
        {children}
      </body>
    </html>
  );
}
