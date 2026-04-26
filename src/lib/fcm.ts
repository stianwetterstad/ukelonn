"use client";

import { app, getMessagingInstance } from "@/lib/firebase";
import { getToken, isSupported, onMessage, type MessagePayload, type Messaging } from "firebase/messaging";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getApps } from "firebase/app";

const FAMILY_ID = "family-default";
const LAST_FCM_TOKEN_KEY = "fcm_token";
const LAST_FCM_STATUS_KEY = "fcm_status";

type DeviceRole = "parent" | "child";

export type PushSupportStatus = {
  isIOS: boolean;
  isStandalone: boolean;
  requiresStandaloneInstall: boolean;
  isSecureOrigin: boolean;
  hasNotificationApi: boolean;
  hasServiceWorker: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  canAttemptPush: boolean;
  reason: string | null;
};

function isSecureMessagingOrigin(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const { protocol, hostname } = window.location;
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}

function isIOSDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const platform = window.navigator.platform;
  const userAgent = window.navigator.userAgent;
  const maxTouchPoints = window.navigator.maxTouchPoints ?? 0;

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true;
}

function persistLastFcmStatus(status: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LAST_FCM_STATUS_KEY, status);
  } catch {
    console.debug("[FCM] Unable to persist FCM status");
  }
}

function persistLastFcmToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (token) {
      window.localStorage.setItem(LAST_FCM_TOKEN_KEY, token);
      return;
    }

    window.localStorage.removeItem(LAST_FCM_TOKEN_KEY);
  } catch {
    console.debug("[FCM] Unable to persist FCM token");
  }
}

export function getPushSupportStatus(): PushSupportStatus {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isStandalone: false,
      requiresStandaloneInstall: false,
      isSecureOrigin: false,
      hasNotificationApi: false,
      hasServiceWorker: false,
      notificationPermission: "unsupported",
      canAttemptPush: false,
      reason: "Push can only be initialized in the browser",
    };
  }

  const isIOS = isIOSDevice();
  const isStandalone = isStandaloneDisplayMode();
  const isSecureOrigin = isSecureMessagingOrigin();
  const hasNotificationApi = "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;
  const notificationPermission = hasNotificationApi ? Notification.permission : "unsupported";
  const requiresStandaloneInstall = isIOS && !isStandalone;

  let reason: string | null = null;
  if (!isSecureOrigin) {
    reason = "Push krever HTTPS eller localhost";
  } else if (requiresStandaloneInstall) {
    reason = "Pa iPhone/iPad virker web-push bare i en installert Home Screen-app";
  } else if (!hasNotificationApi) {
    reason = "Notification API er ikke tilgjengelig i denne nettleseren";
  } else if (!hasServiceWorker) {
    reason = "Service workers er ikke tilgjengelige i denne nettleseren";
  }

  return {
    isIOS,
    isStandalone,
    requiresStandaloneInstall,
    isSecureOrigin,
    hasNotificationApi,
    hasServiceWorker,
    notificationPermission,
    canAttemptPush: reason === null,
    reason,
  };
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
  if (typeof window === "undefined" || !("Notification" in window)) {
    persistLastFcmStatus("notification-api-unavailable");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    persistLastFcmStatus(permission === "granted" ? "permission-granted" : `permission-${permission}`);
    return permission === "granted";
  } catch (error) {
    console.error("Failed to request notification permission:", error);
    persistLastFcmStatus("permission-error");
    return false;
  }
}

export async function initializeFCM(role: DeviceRole = "parent"): Promise<string | null> {
  const debugFirebase = process.env.NEXT_PUBLIC_DEBUG === "true";
  const enableFCM = process.env.NEXT_PUBLIC_ENABLE_FCM === "true";

  if (!enableFCM) {
    console.info("[FCM] Skipping initialization: NEXT_PUBLIC_ENABLE_FCM is not true");
    persistLastFcmStatus("disabled-by-env");
    return null;
  }

  const pushSupport = getPushSupportStatus();

  if (!pushSupport.isSecureOrigin) {
    console.info("[FCM] Skipping initialization: insecure context (requires HTTPS or localhost)");
    persistLastFcmStatus("insecure-origin");
    persistLastFcmToken(null);
    return null;
  }

  if (pushSupport.requiresStandaloneInstall) {
    console.info("[FCM] Skipping initialization on iOS: app must be launched from Home Screen for push support");
    persistLastFcmStatus("ios-requires-home-screen-install");
    persistLastFcmToken(null);
    return null;
  }

  const fcmVapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
  if (debugFirebase) {
    console.log("[FCM] NEXT_PUBLIC_FCM_VAPID_KEY present:", !!fcmVapidKey);
  }
  if (!fcmVapidKey) {
    console.warn("[FCM] Skipping initialization: NEXT_PUBLIC_FCM_VAPID_KEY is missing");
    persistLastFcmStatus("missing-vapid-key");
    persistLastFcmToken(null);
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
    persistLastFcmStatus("messaging-unsupported");
    persistLastFcmToken(null);
    return null;
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn("FCM not supported in this browser");
      persistLastFcmStatus("messaging-instance-unavailable");
      persistLastFcmToken(null);
      return null;
    }

    // Request permission
    if (debugFirebase) {
      console.log("[FCM] Requesting notification permission...");
    }
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
      console.warn("[FCM] Notification permission denied");
      persistLastFcmToken(null);
      return null;
    }
    if (debugFirebase) {
      console.log("[FCM] Notification permission granted");
    }

    // Register service worker explicitly
    if (!("serviceWorker" in navigator)) {
      console.error("[FCM] Service workers are not supported in this browser");
      persistLastFcmStatus("service-worker-unavailable");
      persistLastFcmToken(null);
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
      persistLastFcmStatus("service-worker-registration-failed");
      persistLastFcmToken(null);
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
      persistLastFcmStatus("get-token-failed");
      persistLastFcmToken(null);
      return null;
    }

    if (!token) {
      console.warn("[FCM] Failed to get FCM token - returned null for", swUrl);
      persistLastFcmStatus("empty-token");
      persistLastFcmToken(null);
      return null;
    }

    console.log("[FCM] FCM token obtained successfully:", token.substring(0, 20) + "...");
    persistLastFcmStatus("token-ready");
    persistLastFcmToken(token);

    // Save token to Firestore
    await saveFCMToken(token, role);

    // Set up message listener
    setupMessageListener(messaging);

    return token;
  } catch (error) {
    console.error("[FCM] FCM initialization failed:", error);
    persistLastFcmStatus("initialization-error");
    persistLastFcmToken(null);
    return null;
  }
}

export async function emulateRoleNotification(role: DeviceRole): Promise<void> {
  const pushSupport = getPushSupportStatus();

  if (!pushSupport.hasNotificationApi) {
    throw new Error("Notifications er ikke tilgjengelig i denne nettleseren.");
  }

  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    throw new Error("Varseltilgang ble ikke gitt.");
  }

  const title = role === "parent" ? "Testvarsel til forelder" : "Testvarsel til barn";
  const body =
    role === "parent"
      ? "Dette emulerer godkjenningsvarsel for forelder pa iPhone/iPad."
      : "Dette emulerer statusvarsel for barn pa iPhone/iPad.";
  const data = { link: `${APP_BASE_PATH}/${role}/?src=ios-local-test` };
  const options: NotificationOptions = {
    body,
    icon: `${APP_BASE_PATH}/icon-192.png`,
    badge: `${APP_BASE_PATH}/icon-192.png`,
    data,
  };

  if (pushSupport.hasServiceWorker) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    persistLastFcmStatus(`local-test-${role}`);
    return;
  }

  new Notification(title, options);
  persistLastFcmStatus(`local-test-${role}`);
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
