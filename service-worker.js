/* ==========================================================
   ReelMind AI
   service-worker.js
   Version 1.0.0
========================================================== */

const CACHE_NAME = "reelmind-v1";

const APP_SHELL = [

  "/",

  "/index.html",

  "/style.css",

  "/script.js",

  "/manifest.json"

];

/* ==========================================================
   INSTALL
========================================================== */

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => cache.addAll(APP_SHELL))

  );

  self.skipWaiting();

});

/* ==========================================================
   ACTIVATE
========================================================== */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys =>

      Promise.all(

        keys.map(key => {

          if (key !== CACHE_NAME) {

            return caches.delete(key);

          }

        })

      )

    )

  );

  self.clients.claim();

});

/* ==========================================================
   FETCH
========================================================== */

self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  event.respondWith(

    caches.match(event.request)

      .then(cacheResponse => {

        if (cacheResponse) {

          return cacheResponse;

        }

        return fetch(event.request)

          .then(networkResponse => {

            if (

              !networkResponse ||

              networkResponse.status !== 200 ||

              networkResponse.type !== "basic"

            ) {

              return networkResponse;

            }

            const responseClone =

              networkResponse.clone();

            caches.open(CACHE_NAME)

              .then(cache => {

                cache.put(

                  event.request,

                  responseClone

                );

              });

            return networkResponse;

          });

      })

      .catch(() => {

        if (

          event.request.destination === "document"

        ) {

          return caches.match("/index.html");

        }

      })

  );

});

/* ==========================================================
   PUSH NOTIFICATIONS
========================================================== */

self.addEventListener("push", event => {

  const data = event.data

    ? event.data.json()

    : {

        title: "ReelMind AI",

        body: "Your video is ready!"

      };

  event.waitUntil(

    self.registration.showNotification(

      data.title,

      {

        body: data.body,

        icon: "/assets/icons/icon-192.png",

        badge: "/assets/icons/icon-96.png"

      }

    )

  );

});

/* ==========================================================
   NOTIFICATION CLICK
========================================================== */

self.addEventListener(

  "notificationclick",

  event => {

    event.notification.close();

    event.waitUntil(

      clients.openWindow("/")

    );

  }

);

/* ==========================================================
   BACKGROUND SYNC
========================================================== */

self.addEventListener(

  "sync",

  event => {

    if (event.tag === "sync-library") {

      event.waitUntil(

        Promise.resolve()

      );

    }

  }

);

/* ==========================================================
   MESSAGE
========================================================== */

self.addEventListener(

  "message",

  event => {

    if (

      event.data &&

      event.data.type === "SKIP_WAITING"

    ) {

      self.skipWaiting();

    }

  }

);

/* ==========================================================
   END OF FILE
========================================================== */
