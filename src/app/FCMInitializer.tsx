"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initializeFCM } from "@/lib/fcm";

export function FCMInitializer() {
  const pathname = usePathname();

  useEffect(() => {
    const debug = process.env.NEXT_PUBLIC_DEBUG === "true";

    // FCM is off by default in dev to avoid accidental notification prompts/spam.
    // To test locally, set NEXT_PUBLIC_ENABLE_FCM=true in .env.local and restart the dev server.
    const enableFcm = process.env.NEXT_PUBLIC_ENABLE_FCM === "true";

    if (!enableFcm) {
      console.info(
        "[FCM] Skipping initialization: NEXT_PUBLIC_ENABLE_FCM is not true. Sett NEXT_PUBLIC_ENABLE_FCM=true i .env.local og restart dev-server",
      );
      return;
    }

    console.log("[FCM] Initializing (flag enabled)");

    if (debug) {
      const hasNotificationApi = typeof window !== "undefined" && "Notification" in window;
      console.log("[FCM] window.Notification available:", hasNotificationApi);
      if (hasNotificationApi) {
        console.log("[FCM] Notification.permission on load:", Notification.permission);
      }

      const { protocol, hostname } = window.location;
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      console.log("[FCM] window.location.protocol:", protocol);
      if (protocol !== "https:" && !isLocalhost) {
        console.warn(
          "[FCM] Push notifications require HTTPS (localhost is allowed). Current origin may block notification prompts.",
        );
      }
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("[FCM] Service Workers not supported");
      return;
    }

    const role = pathname.startsWith("/child")
      ? "child"
      : pathname.startsWith("/parent")
        ? "parent"
        : null;

    if (!role) {
      return;
    }

    const initFCM = async () => {
      try {
        const token = await initializeFCM(role);
        if (token) {
          console.log("[FCM] Initialized successfully, token:", token);
        }
      } catch (error) {
        console.error("[FCM] Initialization error:", error);
      }
    };

    // initializeFCM waits for SW activation internally — no artificial delay needed.
    void initFCM();
  }, [pathname]);

  return null;
}
