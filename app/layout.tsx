import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

// Variable names must match what globals.css @theme maps to (--font-sans and
// --font-geist-mono), or the font-sans / font-mono utilities resolve to nothing.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Markdown Studio — MD Viewer & PDF Exporter",
  description:
    "Preview Markdown in real time and export it to a clean, shareable PDF. No account, no database, nothing stored.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto <html>
    // before React hydrates, which is a deliberate server/client mismatch.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={400}>{children}</TooltipProvider>
          <Toaster
            richColors
            closeButton
            position="bottom-right"
            className="print-hidden"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
