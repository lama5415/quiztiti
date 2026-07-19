/* QuizTiti — service worker : rend l'application installable et utilisable
   hors-ligne. Les chemins sont relatifs pour fonctionner aussi bien à la
   racine qu'en sous-dossier (ex. : https://user.github.io/quiztiti/). */

var CACHE = "quiztiti-v1";

// Coquille de l'application, mise en cache dès l'installation.
var SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./img/icon-192.png",
  "./img/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // add() individuel + catch : un asset manquant ne fait pas échouer l'install.
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // on ne touche pas aux ressources externes

  // Navigation : on tente le réseau, sinon la page en cache (mode hors-ligne).
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(function () { return caches.match("./index.html"); }));
    return;
  }

  // Paquets d'exemple : réseau d'abord (pour rester à jour), cache en secours.
  if (url.pathname.indexOf("/exemples/") !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // Reste (coquille, icônes) : cache d'abord, réseau en secours.
  e.respondWith(
    caches.match(req).then(function (r) { return r || fetch(req); })
  );
});
