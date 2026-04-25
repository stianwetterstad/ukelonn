import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { firebaseConfig } from "@/lib/firebaseConfig";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEBUG_FIREBASE = process.env.NEXT_PUBLIC_DEBUG === "true";

if (DEBUG_FIREBASE) {
  console.log("[FB] projectId/appId", firebaseConfig.projectId, firebaseConfig.appId);
  console.log("[FB] getApps().length", getApps().length);
}

let messagingInstancePromise: Promise<Messaging | null> | null = null;

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!messagingInstancePromise) {
    messagingInstancePromise = (async () => {
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        return null;
      }
      return getMessaging(app);
    })();
  }

  return messagingInstancePromise;
}

export { app, auth, db };