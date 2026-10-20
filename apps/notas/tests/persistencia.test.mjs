import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { asegurarPersistencia, reiniciarIntentoPersistencia } from '../src/almacen/persistencia.js';
import {
  tienePermisoEscritura, resolverCarpetaDeCopias, obtenerCarpetaGuardada, guardarCarpetaElegida,
} from '../src/archivos/copias.js';

function simularNavegador(storage) {
  Object.defineProperty(globalThis, 'navigator', { value: { storage }, configurable: true, writable: true });
}

test('persistencia: no se pide si todavía no hay notas', async () => {
  reiniciarIntentoPersistencia();
  let llamadas = 0;
  simularNavegador({ persisted: async () => false, persist: async () => { llamadas++; return true; } });
  assert.equal(await asegurarPersistencia({ hayNotas: false }), null);
  assert.equal(llamadas, 0);
});

test('persistencia: se pide una sola vez por sesión cuando hay notas', async () => {
  reiniciarIntentoPersistencia();
  let llamadas = 0;
  simularNavegador({ persisted: async () => false, persist: async () => { llamadas++; return true; } });
  assert.equal(await asegurarPersistencia({ hayNotas: true }), true);
  assert.equal(await asegurarPersistencia({ hayNotas: true }), null);
  assert.equal(llamadas, 1);
});

test('persistencia: si el navegador falla o la niega, no rompe la app', async () => {
  reiniciarIntentoPersistencia();
  simularNavegador({ persisted: async () => false, persist: async () => { throw new Error('no'); } });
  assert.equal(await asegurarPersistencia({ hayNotas: true }), false);
  reiniciarIntentoPersistencia();
  simularNavegador({ persisted: async () => false, persist: async () => false });
  assert.equal(await asegurarPersistencia({ hayNotas: true }), false);
});

test('persistencia: sin API de almacenamiento devuelve null', async () => {
  reiniciarIntentoPersistencia();
  simularNavegador(undefined);
  assert.equal(await asegurarPersistencia({ hayNotas: true }), null);
});

test('carpeta de copias: permiso concedido, por pedir y negado', async () => {
  assert.equal(await tienePermisoEscritura(null), false);
  assert.equal(await tienePermisoEscritura({ queryPermission: async () => 'granted' }), true);
  const aPedir = { queryPermission: async () => 'prompt', requestPermission: async () => 'granted' };
  assert.equal(await tienePermisoEscritura(aPedir), false, 'sin pedir no consulta al usuario');
  assert.equal(await tienePermisoEscritura(aPedir, { pedir: true }), true);
  const negado = { queryPermission: async () => 'prompt', requestPermission: async () => 'denied' };
  assert.equal(await tienePermisoEscritura(negado, { pedir: true }), false);
  const roto = { queryPermission: async () => { throw new Error('x'); } };
  assert.equal(await tienePermisoEscritura(roto, { pedir: true }), false);
});

test('carpeta de copias: sin carpeta recordada abre el selector y no falla si no se puede recordar', async () => {
  const elegida = { name: 'Respaldos', getFileHandle() {} };
  let selectores = 0;
  globalThis.window = { showDirectoryPicker: async () => { selectores++; return elegida; } };
  assert.equal(await obtenerCarpetaGuardada(), null);
  // Un objeto con funciones no se puede clonar en IndexedDB: guardar devuelve false, sin lanzar error.
  assert.equal(await guardarCarpetaElegida(elegida), false);
  const res = await resolverCarpetaDeCopias();
  assert.equal(res, elegida);
  assert.equal(selectores, 1);
  await resolverCarpetaDeCopias({ elegirOtra: true });
  assert.equal(selectores, 2);
  delete globalThis.window;
});
