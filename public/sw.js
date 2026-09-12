// Univolt offline service worker — Task 1
const CACHE_NAME = "univolt-v1";

const PRECACHE_URLS = [
  "/",
  "/mediapipe/wasm/vision_wasm_internal.js",
  "/mediapipe/wasm/vision_wasm_internal.wasm",
  "/mediapipe/wasm/vision_wasm_module_internal.js",
  "/mediapipe/wasm/vision_wasm_module_internal.wasm",
  "/mediapipe/wasm/vision_wasm_nosimd_internal.js",
  "/mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
  "/models/blaze_face_short_range.tflite",
  "/models/gesture_recognizer.task",
];

// ── Install: pre-cache critical assets ──────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] precache miss:", url, err);
          }),
        ),
      ),
    ),
  );
  // Take control immediately — no need to wait for old SW to finish.
  self.skipWaiting();
});

// ── Activate: claim all clients ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Remove old caches that don't match CACHE_NAME.
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: cache-first for same-origin GET, pass-through otherwise ───────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only intercept same-origin GET requests.
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      // Not in cache — fetch from network and store for next time.
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Network error with no cached fallback — browser will show its own error.
        return new Response("Offline — resource not cached.", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
    }),
  );
});
