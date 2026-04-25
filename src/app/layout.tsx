import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TaskProvider } from "@/lib/TaskContext";
import { APP_BASE_PATH } from "@/lib/appBasePath";
import { PwaRegistration } from "./PwaRegistration";
import { FCMInitializer } from "./FCMInitializer";

export const metadata: Metadata = {
  title: "Family Allowance App",
  description: "Next.js TypeScript PWA starter for family allowance tracking",
  manifest: "/ukelonn/manifest.webmanifest",
  applicationName: "Family Allowance App",
  icons: {
    icon: [
      { url: `${APP_BASE_PATH}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${APP_BASE_PATH}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${APP_BASE_PATH}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ukelonn",
  },
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
        <TaskProvider>
          <PwaRegistration />
          <FCMInitializer />
          {children}
        </TaskProvider>
      </body>
    </html>
  );
}
