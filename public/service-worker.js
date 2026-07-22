const CACHE_NAME = "xiaohongshu-article-notes-v7";
const APP_SCOPE = new URL(self.registration.scope);
const CORE_ASSETS = ["", "index.html", "manifest.webmanifest", "icons/app-icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].map(
  (path) => new URL(path, APP_SCOPE).toString(),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch((error) =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match(new URL("index.html", APP_SCOPE).toString());
          }

          return Promise.reject(error);
        }),
      ),
  );
});
