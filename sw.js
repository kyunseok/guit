const VERSION = "__BUILD_VERSION__";
const FILES = __SHELL_FILES__;
const PREFIX = "guitarhana:" + self.registration.scope;
const CACHE = PREFIX + VERSION;
const urls = new Set(FILES.map(path => new URL(path, self.registration.scope).href));
const indexUrl = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...urls].map(url => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  const root = new URL(self.registration.scope);
  if (url.origin !== root.origin) return;
  const navigation = request.mode === "navigate" && (url.pathname === root.pathname || url.pathname === new URL(indexUrl).pathname);
  const target = navigation ? indexUrl : request.url;
  if (!navigation && !urls.has(target)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(target) || fetch(request);
  })());
});
