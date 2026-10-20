// Almacenamiento persistente: pide al navegador que no borre los datos si falta espacio.
// Importante en iPad/Safari. Solo existe en conexiones seguras (HTTPS o localhost).

export function almacenamientoDisponible() {
  return typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.persist === 'function';
}

export async function estadoAlmacenamiento() {
  if (!almacenamientoDisponible()) return { disponible: false, persistente: false, usado: 0, cuota: 0 };
  const [persistente, estimacion] = await Promise.all([
    navigator.storage.persisted(),
    navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve({}),
  ]);
  return { disponible: true, persistente, usado: estimacion.usage || 0, cuota: estimacion.quota || 0 };
}

export async function pedirPersistencia() {
  if (!almacenamientoDisponible()) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

// Pide la protección una sola vez por sesión y solo cuando ya hay notas que cuidar.
// No necesita un toque de la persona: Chrome y Edge la conceden según el uso, y Safari la concede
// a la app instalada en la pantalla de inicio. Si el navegador la niega, el botón «Proteger datos» sigue disponible.
let intentoRealizado = false;

export async function asegurarPersistencia({ hayNotas }) {
  if (!hayNotas || intentoRealizado || !almacenamientoDisponible()) return null;
  intentoRealizado = true;
  try {
    return await pedirPersistencia();
  } catch {
    return false;
  }
}

// Solo para las pruebas automáticas.
export function reiniciarIntentoPersistencia() {
  intentoRealizado = false;
}
