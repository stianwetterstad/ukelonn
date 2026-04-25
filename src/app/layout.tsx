import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TaskProvider } from "@/lib/TaskContext";

export const metadata: Metadata = {
  title: "Family Allowance App",
  description: "Next.js TypeScript PWA starter for family allowance tracking",
  manifest: "/ukelonn/manifest.webmanifest",
  applicationName: "Family Allowance App",
};

export const viewport: Viewport = {
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TaskProvider>{children}</TaskProvider>
      </body>
    </html>
  );
}
