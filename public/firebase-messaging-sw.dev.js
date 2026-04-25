importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCEXSpT2oODyKR9c4i320sItCgivkXqsxU",
  authDomain: "ukelonn-1cdbf.firebaseapp.com",
  projectId: "ukelonn-1cdbf",
  storageBucket: "ukelonn-1cdbf.firebasestorage.app",
  messagingSenderId: "775837524786",
  appId: "1:775837524786:web:04b4550b222c815c1bad2b",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW DEV] Background message:", payload);

  const title = payload.notification?.title ?? "Ukelonn";
  const body = payload.notification?.body ?? "";
  const icon = payload.notification?.icon ?? "/ukelonn/icon-192.png";

  self.registration.showNotification(title, {
    body,
    icon,
    badge: "/ukelonn/icon-192.png",
    data: payload.data ?? {},
  });
});
