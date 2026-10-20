import { pedido, transaccion } from './db.js';

export function guardarElementos(elementos) {
  const ahora = Date.now();
  return transaccion(['elementos'], 'readwrite', (tx) => {
    const almacen = tx.objectStore('elementos');
    elementos.forEach((e) => almacen.put({ ...e, modificado: ahora }));
  });
}

export function listarElementos(documentoId) {
  return transaccion(['elementos'], 'readonly', (tx) => pedido(tx.objectStore('elementos').index('documentoId').getAll(documentoId)));
}

export function contarElementos(documentoId) {
  return transaccion(['elementos'], 'readonly', (tx) => pedido(tx.objectStore('elementos').index('documentoId').count(documentoId)));
}

export function borrarElementos(ids) {
  return transaccion(['elementos'], 'readwrite', (tx) => {
    ids.forEach((id) => tx.objectStore('elementos').delete(id));
  });
}
