/**
 * sw.js — ARROWZ · Service Worker (PWA)
 *
 * Caches all game assets on install so the game works offline.
 * Update CACHE_VERSION when deploying new assets.
 */

const CACHE_VERSION = 'arrowz-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/audio.js',
  './js/levels.js',
  './js/engine.js',
  './js/ui.js',
  './js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request))
  );
});
