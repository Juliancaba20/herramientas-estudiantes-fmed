// Guardado de lo pendiente de una escena (elementos nuevos, modificados o borrados).
// Recibe una función `obtenerEscena()` y no una escena fija: así, si el editor cambia de escena
// (por ejemplo, al pasar de una tarjeta a otra), siempre se guarda la escena vigente.
import { borrarElementos, guardarElementos } from './elementos.js';

// trasGuardar (opcional) se ejecuta dentro de la misma protección: si falla, los pendientes también vuelven a la escena.
export async function guardarPendientesDeEscena(obtenerEscena, almacen = { guardarElementos, borrarElementos }, trasGuardar = null) {
  const escena = obtenerEscena();
  if (!escena) return { guardados: 0, borrados: 0 };
  const p = escena.tomarPendientes();
  try {
    if (p.guardar.length) await almacen.guardarElementos(p.guardar);
    if (p.borrar.length) await almacen.borrarElementos(p.borrar);
    if (trasGuardar) await trasGuardar({ guardados: p.guardar.length, borrados: p.borrar.length });
  } catch (e) {
    // Los pendientes vuelven a la escena de la que salieron, no a otra.
    escena.devolverPendientes(p);
    throw e;
  }
  return { guardados: p.guardar.length, borrados: p.borrar.length };
}
