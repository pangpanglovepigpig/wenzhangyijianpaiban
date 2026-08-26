import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test, vi } from "vitest";

const APP_SCOPE = "https://example.com/wenzhangyijianpaiban/";
const CURRENT_CACHE = "xiaohongshu-article-notes-v10";
const CURRENT_SCRIPT = `${APP_SCOPE}assets/app-current.js`;
const CURRENT_STYLES = `${APP_SCOPE}assets/app-current.css`;
const serviceWorkerSource = readFileSync(new URL("./public/service-worker.js", import.meta.url), "utf8");

describe("service worker cache upgrades", () => {
  test("pre-caches the current hashed JavaScript and CSS before taking control", async () => {
    const harness = createHarness();

    await harness.install();

    expect(harness.cacheKeys(CURRENT_CACHE)).toEqual(
      expect.arrayContaining([
        APP_SCOPE,
        `${APP_SCOPE}index.html`,
        CURRENT_SCRIPT,
        CURRENT_STYLES,
        `${APP_SCOPE}manifest.webmanifest`,
      ]),
    );
    expect(harness.self.skipWaiting).toHaveBeenCalledOnce();
  });

  test("keeps the previous worker active if a current app-shell asset is missing", async () => {
    const harness = createHarness({ failedAsset: "app-current.js" });

    await expect(harness.install()).rejects.toThrow();
    expect(harness.self.skipWaiting).not.toHaveBeenCalled();
  });

  test("deletes only old caches that belong to this app", async () => {
    const harness = createHarness();
    await harness.openCache(CURRENT_CACHE);
    await harness.openCache("xiaohongshu-article-notes-v9");
    await harness.openCache("another-site-cache");

    await harness.activate();

    expect(await harness.cacheNames()).toEqual(expect.arrayContaining([CURRENT_CACHE, "another-site-cache"]));
    expect(await harness.cacheNames()).not.toContain("xiaohongshu-article-notes-v9");
    expect(harness.self.clients.claim).toHaveBeenCalledOnce();
  });

  test("serves the cached document and hashed assets when the network fails", async () => {
    const harness = createHarness();
    await harness.install();
    harness.goOffline();

    const documentResponse = await harness.fetch({ method: "GET", mode: "navigate", url: APP_SCOPE });
    const scriptResponse = await harness.fetch({ method: "GET", mode: "cors", url: CURRENT_SCRIPT });

    expect(await documentResponse.text()).toContain("app-current.js");
    expect(await scriptResponse.text()).toBe(`asset:${CURRENT_SCRIPT}`);
  });
});

function createHarness({ failedAsset = "" } = {}) {
  const listeners = new Map();
  const cacheStores = new Map();
  const cacheObjects = new Map();
  let offline = false;

  const self = {
    registration: { scope: APP_SCOPE },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };

  const requestKey = (request) => (typeof request === "string" ? request : request.url);

  const fetchMock = vi.fn(async (request) => {
    const url = requestKey(request);
    if (offline) throw new TypeError("Network unavailable");
    if (failedAsset && url.includes(failedAsset)) return new Response("missing", { status: 404 });
    if (url.includes("index.html?sw-precache=")) {
      return new Response(
        `<!doctype html><script type="module" src="${CURRENT_SCRIPT}"></script><link rel="stylesheet" href="${CURRENT_STYLES}">`,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    return new Response(`asset:${url}`, { status: 200 });
  });

  function cacheFor(name) {
    if (cacheObjects.has(name)) return cacheObjects.get(name);

    const store = new Map();
    cacheStores.set(name, store);
    const cache = {
      async put(request, response) {
        store.set(requestKey(request), response.clone());
      },
      async match(request) {
        const response = store.get(requestKey(request));
        return response ? response.clone() : undefined;
      },
      async addAll(urls) {
        for (const url of urls) {
          const response = await fetchMock(url);
          if (!response.ok) throw new TypeError(`Unable to cache ${url}`);
          await this.put(url, response);
        }
      },
    };
    cacheObjects.set(name, cache);
    return cache;
  }

  const caches = {
    async open(name) {
      return cacheFor(name);
    },
    async keys() {
      return Array.from(cacheStores.keys());
    },
    async delete(name) {
      cacheObjects.delete(name);
      return cacheStores.delete(name);
    },
  };

  vm.runInNewContext(serviceWorkerSource, {
    Array,
    Error,
    Map,
    Promise,
    Set,
    URL,
    caches,
    fetch: fetchMock,
    self,
  });

  return {
    self,
    openCache: (name) => caches.open(name),
    cacheNames: () => caches.keys(),
    cacheKeys: (name) => Array.from(cacheStores.get(name)?.keys() ?? []),
    goOffline() {
      offline = true;
    },
    async install() {
      let lifetime;
      listeners.get("install")({ waitUntil: (promise) => (lifetime = promise) });
      return lifetime;
    },
    async activate() {
      let lifetime;
      listeners.get("activate")({ waitUntil: (promise) => (lifetime = promise) });
      return lifetime;
    },
    async fetch(request) {
      let response;
      listeners.get("fetch")({ request, respondWith: (promise) => (response = promise) });
      return response;
    },
  };
}
