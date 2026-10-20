// Modo instalable y uso sin conexión (Etapa 13): registro del service worker, aviso de versión nueva,
// instalación guiada y estado de conexión. Sin React y con el navegador inyectado, para poder probarlo.

export const EVENTO_GUARDAR_TODO = 'anotomia:guardar-todo';
const CADA_HORA = 60 * 60 * 1000;

export function crearGestorPWA({ nav = globalThis.navigator, win = globalThis.window, urlSW = './sw.js', produccion = true } = {}) {
  let estado = {
    actualizacionLista: false, // hay una versión nueva esperando
    instalable: false, // el navegador permite instalar con un solo botón
    instalada: false, // ya se abre como app
    sinConexion: false,
    lista: false, // el service worker ya guardó todo: la app funciona sin conexión
  };
  let registro = null;
  let promptInstalacion = null;
  const oyentes = new Set();

  const cambiar = (parcial) => {
    estado = { ...estado, ...parcial };
    oyentes.forEach((f) => f());
  };

  const comprobarInstalada = () => {
    const standalone = !!win?.matchMedia?.('(display-mode: standalone)')?.matches || nav?.standalone === true;
    if (standalone !== estado.instalada) cambiar({ instalada: standalone });
  };

  function vigilar(reg) {
    registro = reg;
    if (reg.active && !reg.waiting) cambiar({ lista: true });
    if (reg.waiting && nav.serviceWorker.controller) cambiar({ actualizacionLista: true });
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state !== 'installed') return;
        // Con un controlador activo, lo instalado es una actualización; sin él, es la primera instalación.
        if (nav.serviceWorker.controller) cambiar({ actualizacionLista: true });
        else cambiar({ lista: true });
      });
    });
  }

  function iniciar() {
    comprobarInstalada();
    cambiar({ sinConexion: nav?.onLine === false });
    win?.addEventListener?.('online', () => cambiar({ sinConexion: false }));
    win?.addEventListener?.('offline', () => cambiar({ sinConexion: true }));
    win?.addEventListener?.('beforeinstallprompt', (e) => {
      e.preventDefault(); // se ofrece desde nuestro propio botón
      promptInstalacion = e;
      cambiar({ instalable: true });
    });
    win?.addEventListener?.('appinstalled', () => {
      promptInstalacion = null;
      cambiar({ instalable: false, instalada: true });
    });
    win?.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', comprobarInstalada);

    if (!produccion || !nav?.serviceWorker) return;
    const registrar = () => {
      nav.serviceWorker.register(urlSW).then((reg) => {
        vigilar(reg);
        // Busca versiones nuevas al volver a la app y cada hora.
        win.document?.addEventListener?.('visibilitychange', () => {
          if (win.document.visibilityState === 'visible') reg.update().catch(() => {});
        });
        win.setInterval?.(() => reg.update().catch(() => {}), CADA_HORA);
      }).catch(() => { /* sin service worker la app sigue funcionando en línea */ });
    };
    if (win.document?.readyState === 'complete') registrar();
    else win.addEventListener('load', registrar, { once: true });
  }

  // Aplica la versión nueva: primero guarda todo lo pendiente de los editores y recién después recarga.
  async function aplicarActualizacion() {
    const espera = registro?.waiting;
    if (!espera) return false;
    const detalle = { promesas: [] };
    win.dispatchEvent(new win.CustomEvent(EVENTO_GUARDAR_TODO, { detail: detalle }));
    await Promise.allSettled(detalle.promesas);
    nav.serviceWorker.addEventListener('controllerchange', () => win.location.reload(), { once: true });
    espera.postMessage({ tipo: 'SALTAR_ESPERA' });
    return true;
  }

  async function instalar() {
    if (!promptInstalacion) return 'no-disponible';
    const p = promptInstalacion;
    promptInstalacion = null;
    cambiar({ instalable: false });
    p.prompt();
    const { outcome } = await p.userChoice;
    return outcome; // 'accepted' | 'dismissed'
  }

  return {
    iniciar,
    aplicarActualizacion,
    instalar,
    obtener: () => estado,
    suscribir(f) { oyentes.add(f); return () => oyentes.delete(f); },
  };
}
