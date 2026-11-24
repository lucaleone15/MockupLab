// Replaces the old MockupLab app's service worker on mockuplab3d.netlify.app: clears its caches,
// unregisters, and reloads open tabs, which then follow the redirect to https://mockuplab.luca-leone.ch.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
