import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Providers from "@/components/Providers";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["700", "800", "900"] });

export const metadata: Metadata = {
  title: "My EXtreme Trainer — Transform Your Body. Build Your Community.",
  description: "The ultimate fitness and health platform combining food journal, workout tracker, social community, AI coaching, and more.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "My EXtreme Trainer" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F87404" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${dmSans.variable} ${playfair.variable} font-sans min-h-screen antialiased bg-[#F8F9FA] text-gray-900`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" toastOptions={{ style: { background: '#ffffff', color: '#111827', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }} />
      </body>
    </html>
  );
}
