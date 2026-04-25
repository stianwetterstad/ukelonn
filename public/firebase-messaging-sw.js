import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getMessaging,
  onBackgroundMessage,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging/sw.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEXSpT2oODyKR9c4i320sItCgivkXqsxU",
  authDomain: "ukelonn-1cdbf.firebaseapp.com",
  projectId: "ukelonn-1cdbf",
  storageBucket: "ukelonn-1cdbf.firebasestorage.app",
  messagingSenderId: "775837524786",
  appId: "1:775837524786:web:04b4550b222c815c1bad2b",
};

console.log("[FCM SW] module service worker loaded at", self.location.pathname);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log("[FCM SW] Background message received:", payload);
});
