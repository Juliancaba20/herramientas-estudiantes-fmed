// Autoguardado con espera: agrupa los cambios rápidos y guarda al dejar de tocar.
// También guarda de inmediato al ocultar la pestaña o cerrar, para no perder el último cambio.
// Estados: 'sin-cambios' | 'pendiente' | 'guardando' | 'guardado' | 'error'

export function crearAutoguardado(guardar, { espera = 800 } = {}) {
  let pendiente = null;
  let hayPendiente = false;
  let temporizador = null;
  let cola = Promise.resolve();
  let estado = 'sin-cambios';
  const oyentes = new Set();

  const cambiar = (e, err = null) => { estado = e; oyentes.forEach((f) => f(e, err)); };

  function ejecutar() {
    clearTimeout(temporizador);
    temporizador = null;
    if (!hayPendiente) return cola;
    const datos = pendiente;
    hayPendiente = false;
    pendiente = null;
    cambiar('guardando');
    cola = cola.then(() => guardar(datos)).then(
      () => cambiar(hayPendiente ? 'pendiente' : 'guardado'),
      (err) => {
        const esCuota = err?.name === 'QuotaExceededError' || err?.code === 22 || err?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
        cambiar(esCuota ? 'error-espacio' : 'error', err);
      },
    );
    return cola;
  }

  function programar(datos) {
    pendiente = datos;
    hayPendiente = true;
    cambiar('pendiente');
    clearTimeout(temporizador);
    temporizador = setTimeout(ejecutar, espera);
  }

  // Antes de actualizar la app (Etapa 13) se pide guardar todo y se espera a que termine.
  const alGuardarTodo = (e) => { e.detail?.promesas?.push(ejecutar()); };
  if (typeof window !== 'undefined') window.addEventListener('anotomia:guardar-todo', alGuardarTodo);

  const alOcultar = () => { if (typeof document === 'undefined' || document.visibilityState === 'hidden') ejecutar(); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alOcultar);
  if (typeof window !== 'undefined') window.addEventListener('pagehide', ejecutar);

  return {
    programar,
    vaciar: ejecutar,
    estado: () => estado,
    suscribir(f) { oyentes.add(f); return () => oyentes.delete(f); },
    destruir() {
      ejecutar();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', alOcultar);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', ejecutar);
        window.removeEventListener('anotomia:guardar-todo', alGuardarTodo);
      }
    },
  };
}
