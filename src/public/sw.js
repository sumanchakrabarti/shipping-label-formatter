// Service Worker for PWA / iOS home screen support

const CACHE_NAME = "label-print-v1";
const ASSETS = ["/", "/static/icon-192.png", "/static/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
});

self.addEventListener("fetch", (event) => {
  // Network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
