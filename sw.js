self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", () => {
  // The hosted app should always use the live server response.
});
