// Service worker de Anotomía (Etapa 13). Se genera en la compilación (sw/generar.mjs): las dos constantes
// siguientes se completan con la huella del contenido y la lista de archivos de la app.
// No usa nada fuera de su propia carpeta.
const VERSION = '__VERSION__';
const CACHE = 'anotomia-' + VERSION;
const ARCHIVOS = __ARCHIVOS__;
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
