import { pedido, transaccion } from './db.js';

export async function obtenerAjuste(clave, porDefecto = null) {
  const fila = await transaccion(['ajustes'], 'readonly', (tx) => pedido(tx.objectStore('ajustes').get(clave)));
  return fila ? fila.valor : porDefecto;
}

export function guardarAjuste(clave, valor) {
  return transaccion(['ajustes'], 'readwrite', (tx) => pedido(tx.objectStore('ajustes').put({ clave, valor })));
}
