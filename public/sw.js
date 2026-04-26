const CACHE_NAME = "ukelonn-v1";
const APP_SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.svg",
  "./apple-touch-icon.png",
  "./child/",
  "./parent/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  let notificationData = {
    title: "Notification",
    body: "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log("Push data:", data);

      if (data.notification) {
        notificationData.title = data.notification.title || notificationData.title;
        notificationData.body = data.notification.body || notificationData.body;
        if (data.notification.icon) {
          notificationData.icon = data.notification.icon;
        }
      }

      // Also handle FCM-style data with title and body at top level
      if (data.title) {
        notificationData.title = data.title;
      }
      if (data.body) {
        notificationData.body = data.body;
      }
      if (data.link && typeof data.link === "string") {
        notificationData.data = { link: data.link };
      }
    } catch (error) {
      console.error("Failed to parse push data:", error);
      if (event.data.text) {
        notificationData.body = event.data.text();
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: "ukelonn-notification",
      requireInteraction: false,
      data: notificationData.data,
    })
  );
});

function resolveNotificationLink(data) {
  const rawLink = typeof data?.link === "string" ? data.link : null;
  if (!rawLink) {
    return "/ukelonn/";
  }

  if (rawLink.startsWith("http://") || rawLink.startsWith("https://")) {
    return rawLink;
  }

  return rawLink.startsWith("/") ? rawLink : `/ukelonn/${rawLink}`;
}

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event.notification.title);
  event.notification.close();

  const targetLink = resolveNotificationLink(event.notification.data);
  const targetUrl = new URL(targetLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      // Reuse an existing tab on this origin and navigate it to the target link.
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin)) {
          await client.navigate(targetUrl);
          await client.focus();
          return;
        }
      }
      // If not, open a new window/tab at the target link.
      if (clients.openWindow) {
        await clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          return cachedResponse || caches.match("./");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }

        return response;
      });
    })
  );
});
