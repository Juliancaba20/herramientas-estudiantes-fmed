// Service worker de Anotomía (Etapa 13). Se genera en la compilación (sw/generar.mjs): las dos constantes
// siguientes se completan con la huella del contenido y la lista de archivos de la app.
// No usa nada fuera de su propia carpeta.
const VERSION = '2fd7968169b7';
const CACHE = 'anotomia-' + VERSION;
const ARCHIVOS = [
  "./assets/figtree-latin-400-italic-BSc-2xHp.woff2",
  "./assets/figtree-latin-400-normal-g7Dtegnw.woff2",
  "./assets/figtree-latin-500-normal-BWnGEVsr.woff2",
  "./assets/figtree-latin-600-normal-Cv_xCTDl.woff2",
  "./assets/figtree-latin-700-italic-Bk3jHuty.woff2",
  "./assets/figtree-latin-700-normal-th6qEP7c.woff2",
  "./assets/index-B4Kd2qrF.css",
  "./assets/index-uembvrct.js",
  "./assets/newsreader-latin-500-normal-B66TYsaK.woff2",
  "./assets/newsreader-latin-600-normal-30OJ_TG_.woff2",
  "./favicon.svg",
  "./iconos/apple-touch-icon.png",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/icono-mascara-512.png",
  "./",
  "./manifest.webmanifest",
  "./index.html"
];
const BASE = new URL('./', self.location).href;
const INICIO = new URL('./index.html', BASE).href;

self.addEventListener('install', (evento) => {
  // No se llama a skipWaiting aquí: la versión nueva espera hasta que la persona acepte actualizar,
  // para no cambiar el código de la app en medio de una nota.
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS.map((a) => new Request(new URL(a, BASE).href, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k.startsWith('anotomia-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SALTAR_ESPERA') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return; // solo lo propio

  if (pedido.mode === 'navigate') {
    // La app es de una sola pantalla: cualquier navegación abre la copia guardada del inicio.
    evento.respondWith(caches.match(INICIO).then((r) => r || fetch(pedido)));
    return;
  }
  evento.respondWith(
    caches.match(pedido, { ignoreSearch: true }).then((r) => r || fetch(pedido)),
  );
});
