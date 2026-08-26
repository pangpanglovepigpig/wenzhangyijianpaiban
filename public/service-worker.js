const CACHE_PREFIX = "xiaohongshu-article-notes-";
const CACHE_NAME = `${CACHE_PREFIX}v10`;
const APP_SCOPE = new URL(self.registration.scope);
const ROOT_URL = APP_SCOPE.toString();
const INDEX_URL = new URL("index.html", APP_SCOPE).toString();
const STATIC_ASSETS = [
  "manifest.webmanifest",
  "icons/app-icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
].map((path) => new URL(path, APP_SCOPE).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(precacheCurrentAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!isCacheableAppRequest(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith(new URL("assets/", APP_SCOPE).pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function precacheCurrentAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const freshIndexUrl = new URL("index.html", APP_SCOPE);
  freshIndexUrl.searchParams.set("sw-precache", CACHE_NAME);

  const indexResponse = await fetch(freshIndexUrl.toString(), { cache: "reload" });
  if (!indexResponse.ok) {
    throw new Error(`Unable to precache index: ${indexResponse.status}`);
  }

  const html = await indexResponse.clone().text();
  const documentAssets = collectDocumentAssets(html);

  await cache.put(ROOT_URL, indexResponse.clone());
  await cache.put(INDEX_URL, indexResponse.clone());
  await cache.addAll(uniqueUrls([...STATIC_ASSETS, ...documentAssets]));
}

function collectDocumentAssets(html) {
  const urls = [];
  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match = attributePattern.exec(html);

  while (match) {
    const candidate = new URL(match[1], APP_SCOPE);
    if (candidate.origin === APP_SCOPE.origin && candidate.pathname.startsWith(APP_SCOPE.pathname)) {
      urls.push(candidate.toString());
    }
    match = attributePattern.exec(html);
  }

  return uniqueUrls(urls);
}

function uniqueUrls(urls) {
  return Array.from(new Set(urls));
}

function isCacheableAppRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === APP_SCOPE.origin && url.pathname.startsWith(APP_SCOPE.pathname);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await cache.put(ROOT_URL, response.clone());
      await cache.put(INDEX_URL, response.clone());
      return response;
    }

    return (await navigationFallback(cache, request)) || response;
  } catch (error) {
    const cached = await navigationFallback(cache, request);
    if (cached) return cached;
    throw error;
  }
}

async function navigationFallback(cache, request) {
  return (await cache.match(request)) || (await cache.match(ROOT_URL)) || cache.match(INDEX_URL);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}
