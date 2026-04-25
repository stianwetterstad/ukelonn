"use client";

import { app, getMessagingInstance } from "@/lib/firebase";
import { getToken, isSupported, onMessage, type MessagePayload, type Messaging } from "firebase/messaging";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getApps } from "firebase/app";

const FAMILY_ID = "family-default";

type DeviceRole = "parent" | "child";

function isSecureMessagingOrigin(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const { protocol, hostname } = window.location;
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}


import { APP_BASE_PATH } from "./appBasePath";

export function getMessagingServiceWorkerPath(): string {
  const isProd = process.env.NODE_ENV === "production";

  const swUrl = isProd
    ? `${APP_BASE_PATH}/firebase-messaging-sw.js`
    : `${APP_BASE_PATH}/firebase-messaging-sw.dev.js`;

  return swUrl;
}

export function getMessagingServiceWorkerScope(): string {
  return `${APP_BASE_PATH}/`;
}


async function cleanupDevServiceWorkers(expectedScope: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const { hostname } = window.location;
  const isDevHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!isDevHost || !("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      const registrationScope = new URL(registration.scope).pathname;
      if (!registrationScope.endsWith(expectedScope)) {
        await registration.unregister();
      }
    }),
  );
}

async function waitForActiveServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
  await registration.update();

  await new Promise<void>((resolve) => {
    if (registration.active) {
      resolve();
      return;
    }

    const worker = registration.installing || registration.waiting;
    if (!worker) {
      resolve();
      return;
    }

    const handleStateChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", handleStateChange);
        resolve();
      }
    };

    worker.addEventListener("statechange", handleStateChange);
  });

  const readyRegistration = await navigator.serviceWorker.ready;
  if (!readyRegistration.active && !registration.active) {
    throw new Error("Service worker is not active after ready()");
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Failed to request notification permission:", error);
    return false;
  }
}

export async function initializeFCM(role: DeviceRole = "parent"): Promise<string | null> {
  const debugFirebase = process.env.NEXT_PUBLIC_DEBUG === "true";
  const enableFCM = process.env.NEXT_PUBLIC_ENABLE_FCM === "true";

  if (!enableFCM) {
    console.info("[FCM] Skipping initialization: NEXT_PUBLIC_ENABLE_FCM is not true");
    return null;
  }

  if (!isSecureMessagingOrigin()) {
    console.info("[FCM] Skipping initialization: insecure context (requires HTTPS or localhost)");
    return null;
  }

  const fcmVapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
  if (debugFirebase) {
    console.log("[FCM] NEXT_PUBLIC_FCM_VAPID_KEY present:", !!fcmVapidKey);
  }
  if (!fcmVapidKey) {
    console.warn("[FCM] Skipping initialization: NEXT_PUBLIC_FCM_VAPID_KEY is missing");
    return null;
  }

  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const messagingSupported = await isSupported().catch(() => false);

  if (debugFirebase) {
    console.log("[FCM] app projectId/appId", app.options.projectId, app.options.appId);
    console.log("[FCM] getApps().length", getApps().length);
    console.log("[FCM] permission, isSupported()", permission, messagingSupported);
  }

  if (!messagingSupported) {
    console.info("[FCM] Skipping initialization: Firebase Messaging is not supported in this browser");
    return null;
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn("FCM not supported in this browser");
      return null;
    }

    // Request permission
    if (debugFirebase) {
      console.log("[FCM] Requesting notification permission...");
    }
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
      console.warn("[FCM] Notification permission denied");
      return null;
    }
    if (debugFirebase) {
      console.log("[FCM] Notification permission granted");
    }

    // Register service worker explicitly
    if (!("serviceWorker" in navigator)) {
      console.error("[FCM] Service workers are not supported in this browser");
      return null;
    }

    const swUrl = getMessagingServiceWorkerPath();
    const scope = getMessagingServiceWorkerScope();
    const isProd = process.env.NODE_ENV === "production";

    let reg: ServiceWorkerRegistration;
    try {
      await cleanupDevServiceWorkers(scope);

      if (isProd) {
        if (debugFirebase) {
          console.log("[FCM] Registering module SW:", swUrl, "scope:", scope);
        }
        reg = await navigator.serviceWorker.register(swUrl, {
          scope,
          type: "module",
          updateViaCache: "none",
        });
      } else {
        if (debugFirebase) {
          console.log("[FCM] Registering compat SW:", swUrl, "scope:", scope);
        }
        reg = await navigator.serviceWorker.register(swUrl, {
          scope,
          updateViaCache: "none",
        });
      }

      if (debugFirebase) {
        console.log("[FCM] swUrl, reg.scope", swUrl, reg.scope);
      }
      await navigator.serviceWorker.ready;
      await reg.update();
      await waitForActiveServiceWorker(reg);
      console.log("[FCM] Service worker registered successfully:", reg);
    } catch (swError) {
      console.error("[FCM] Failed to register service worker at", swUrl, swError);
      return null;
    }

    // Get FCM token with service worker registration
    console.log("[FCM] Requesting FCM token...");
    const tokenOptions: {
      vapidKey: string;
      serviceWorkerRegistration: ServiceWorkerRegistration;
    } = {
      vapidKey: fcmVapidKey,
      serviceWorkerRegistration: reg,
    };

    let token: string;
    try {
      token = await getToken(messaging, tokenOptions);
    } catch (tokenError) {
      const error = tokenError as {
        name?: string;
        code?: string;
        message?: string;
        stack?: string;
      };
      console.error("[FCM] getToken failed after service worker activation", {
        name: error?.name,
        code: error?.code,
        message: error?.message,
        stack: error?.stack,
        hint: "Check firebaseConfig match (projectId/appId/senderId) between app and SW, verify VAPID key, and confirm swUrl/scope under /ukelonn.",
      });
      return null;
    }

    if (!token) {
      console.warn("[FCM] Failed to get FCM token - returned null for", swUrl);
      return null;
    }

    console.log("[FCM] FCM token obtained successfully:", token.substring(0, 20) + "...");

    // Save token to Firestore
    await saveFCMToken(token, role);

    // Set up message listener
    setupMessageListener(messaging);

    return token;
  } catch (error) {
    console.error("[FCM] FCM initialization failed:", error);
    return null;
  }
}

async function saveFCMToken(token: string, role: DeviceRole): Promise<void> {
  try {
    const deviceDocRef = doc(db, "families", FAMILY_ID, "devices", token);

    await setDoc(deviceDocRef, {
      token,
      role,
      platform: "web",
      lastSeen: serverTimestamp(),
    });

    console.log("FCM token saved successfully");
  } catch (error) {
    console.error("Failed to save FCM token:", error);
    throw error;
  }
}

function setupMessageListener(messaging: Messaging): void {
  onMessage(messaging, (payload: MessagePayload) => {
    console.log("Message received (foreground):", payload);

    // Message received while app is in foreground
    // The notification will be shown automatically on Android, but not on web
    // We need to handle it manually
    if (payload.notification) {
      // Show custom notification
      const notificationTitle = payload.notification.title || "Notification";
      const notificationOptions: NotificationOptions = {
        body: payload.notification.body,

icon: payload.notification.icon || `${APP_BASE_PATH}/icon-192.png`,
badge: `${APP_BASE_PATH}/icon-192.png`,


        data: payload.data,
      };

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(notificationTitle, notificationOptions);
        });
      } else {
        // Fallback for browsers without service worker support
        new Notification(notificationTitle, notificationOptions);
      }
    }
  });
}
