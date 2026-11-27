const CACHE_NAME="lifeline-shell-v1";
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(["/manifest.webmanifest","/lifeline-app-icon.svg"])));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(url.pathname==="/manifest.webmanifest"||url.pathname==="/lifeline-app-icon.svg"){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));}});
