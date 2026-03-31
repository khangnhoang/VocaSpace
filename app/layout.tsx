import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

// 1. IMPORT THÊM TOOLTIP PROVIDER Ở ĐÂY
import { TooltipProvider } from "@/components/ui/tooltip";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jakarta",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VocaSpace",
  description: "Nền tảng học tập thông minh",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ${jakarta.className}`}
      >
        <TooltipProvider>
          <main className="min-h-screen">{children}</main>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}