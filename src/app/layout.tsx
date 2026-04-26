import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TaskProvider } from "@/lib/TaskContext";
import { APP_BASE_PATH } from "@/lib/appBasePath";
import { PwaRegistration } from "./PwaRegistration";
import { FCMInitializer } from "./FCMInitializer";

export const metadata: Metadata = {
  title: "Almas ukelønn",
  description: "Ukentlige oppgaver, bonusoppgaver og sparemål for Alma",
  manifest: "/ukelonn/manifest.webmanifest",
  applicationName: "Almas ukelønn",
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
    title: "Almas ukelønn",
  },
  // apple-mobile-web-app-capable must be set explicitly — Next.js 16 does not
  // generate it from appleWebApp.capable. Without this tag iOS may not launch
  // the app in true standalone mode, which blocks web-push on iPhone/iPad.
  other: {
    "apple-mobile-web-app-capable": "yes",
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
    <html lang="no" className="h-full antialiased">
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
