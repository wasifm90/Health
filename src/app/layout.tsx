import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "My Health",
  description: "Food photos, macros, InBody and Apple Health in one daily report.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "My Health", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto min-h-dvh max-w-xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
