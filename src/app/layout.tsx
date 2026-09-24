import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// The sidebar reads the database, so nothing here may be prerendered at build time.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Academy Work Management", template: "%s · Academy Work" },
  description: "Local-first academic progress tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme class is set by a script before first paint, so React must not object to it.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col md:flex-row">
        <a
          href="#main"
          className="bg-background focus:ring-ring sr-only rounded-md px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:ring-2"
        >
          Skip to main content
        </a>
        <AppSidebar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6 outline-none md:px-8 md:py-10"
        >
          {children}
        </main>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
