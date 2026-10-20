// Historial de las operaciones sobre la lista de tarjetas (agregar, duplicar, eliminar).
// Es independiente del historial de cada tarjeta: este solo recuerda qué tarjetas existen.
// Una operación es:
//   { tipo, tarjeta: {id, titulo}, indice, existeAntes, existeDespues, activaAntes, activaDespues, elementos }
// `elementos` guarda el contenido de la tarjeta para poder restaurarla al deshacer una eliminación
// o al rehacer una creación.

export function crearHistorialTarjetas() {
  const pasado = [];
  const futuro = [];
  return {
    pasado,
    futuro,
    registrar(op) { pasado.push(op); futuro.length = 0; },
    puedeDeshacer() { return pasado.length > 0; },
    puedeRehacer() { return futuro.length > 0; },
    tomarDeshacer() { const op = pasado.pop(); if (op) futuro.push(op); return op || null; },
    tomarRehacer() { const op = futuro.pop(); if (op) pasado.push(op); return op || null; },
    limpiarFuturo() { futuro.length = 0; },
  };
}

export function crearOperacion({ tipo, tarjeta, indice, existeAntes, existeDespues, activaAntes, activaDespues, elementos = [] }) {
  return { tipo, tarjeta: { ...tarjeta }, indice, existeAntes, existeDespues, activaAntes, activaDespues, elementos };
}

// Calcula cómo queda la lista al deshacer (haciaAntes = true) o rehacer una operación.
// Trabaja sobre la lista ACTUAL, para no revertir cambios posteriores (nombres u orden de otras tarjetas).
// Devuelve { tarjetas, activa, quitar, restaurar } o null si la operación dejaría el documento sin tarjetas.
export function aplicarOperacion(lista, op, haciaAntes) {
  const deberiaExistir = haciaAntes ? op.existeAntes : op.existeDespues;
  const existe = lista.some((t) => t.id === op.tarjeta.id);
  let tarjetas = lista;
  if (existe && !deberiaExistir) tarjetas = lista.filter((t) => t.id !== op.tarjeta.id);
  else if (!existe && deberiaExistir) {
    tarjetas = [...lista];
    tarjetas.splice(Math.max(0, Math.min(op.indice, lista.length)), 0, { ...op.tarjeta });
  }
  if (!tarjetas.length) return null;
  const buscada = haciaAntes ? op.activaAntes : op.activaDespues;
  const activa = tarjetas.some((t) => t.id === buscada)
    ? buscada
    : tarjetas[Math.max(0, Math.min(op.indice, tarjetas.length - 1))].id;
  return { tarjetas, activa, quitar: existe && !deberiaExistir, restaurar: !existe && deberiaExistir };
}
