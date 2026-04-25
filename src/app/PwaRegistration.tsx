"use client";

import { useEffect } from "react";
import { APP_BASE_PATH } from "@/lib/appBasePath";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(`${APP_BASE_PATH}/sw.js`, {
          scope: `${APP_BASE_PATH}/`,
        });
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
