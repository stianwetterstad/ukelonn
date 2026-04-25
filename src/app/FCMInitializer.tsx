"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initializeFCM } from "@/lib/fcm";

export function FCMInitializer() {
  const pathname = usePathname();

  useEffect(() => {
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

    // DEBUG ONLY: visibility into notification/environment state on app load
    const hasNotificationApi = typeof window !== "undefined" && "Notification" in window;
    console.log("[DEBUG ONLY] window.Notification available:", hasNotificationApi);
    if (hasNotificationApi) {
      console.log("[DEBUG ONLY] Notification.permission on load:", Notification.permission);
    }

    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    console.log("[DEBUG ONLY] window.location.protocol:", protocol);
    if (protocol !== "https:" && !isLocalhost) {
      console.warn(
        "[DEBUG ONLY] Push notifications usually require HTTPS (localhost is allowed). Current origin may block notification prompts.",
      );
    }

    // Check if service worker is supported and registered
    if (!("serviceWorker" in navigator)) {
      console.warn("Service Workers not supported");
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
          console.log("FCM initialized successfully, token:", token);
        }
      } catch (error) {
        console.error("FCM initialization error:", error);
      }
    };

    // Wait a bit for service worker to be ready
    setTimeout(initFCM, 1000);
  }, [pathname]);

  return null;
}
