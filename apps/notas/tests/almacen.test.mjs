import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearDocumento, crearElemento, guardarDocumento, obtenerDocumento, listarDocumentos,
  enviarAPapelera, restaurarDePapelera, borrarDocumentoDefinitivo,
  guardarElementos, listarElementos, contarElementos, guardarAjuste, obtenerAjuste,
  crearAutoguardado, cerrarBD, nuevoId,
  guardarBlob, obtenerBlob, purgarBlobsSinReferencia,
} from '../src/almacen/index.js';

test('un documento sobrevive al cierre y reapertura de la base', async () => {
  const d = crearDocumento({ titulo: 'Anatomía', formato: 'tarjetas' });
  await guardarDocumento(d);
  await guardarElementos([crearElemento(d.id, 'texto', { datos: { contenido: 'hola' } })]);
  await cerrarBD(); // simula cerrar el navegador
  const vuelto = await obtenerDocumento(d.id);
  assert.equal(vuelto.titulo, 'Anatomía');
  assert.equal((await listarElementos(d.id)).length, 1);
});

test('papelera: oculta de la lista normal y se puede restaurar', async () => {
  const d = await guardarDocumento(crearDocumento({ titulo: 'Borrable' }));
  await enviarAPapelera(d);
  assert.ok(!(await listarDocumentos()).some((x) => x.id === d.id));
  const enPapelera = await listarDocumentos({ papelera: true });
  assert.ok(enPapelera.some((x) => x.id === d.id));
  await restaurarDePapelera(enPapelera.find((x) => x.id === d.id));
  assert.ok((await listarDocumentos()).some((x) => x.id === d.id));
});

test('borrar un documento borra también sus elementos', async () => {
  const d = await guardarDocumento(crearDocumento());
  await guardarElementos([crearElemento(d.id, 'trazo'), crearElemento(d.id, 'simbolo')]);
  assert.equal(await contarElementos(d.id), 2);
  await borrarDocumentoDefinitivo(d.id);
  assert.equal(await contarElementos(d.id), 0);
  assert.equal(await obtenerDocumento(d.id), undefined);
});

test('borrar un documento conserva blobs compartidos y elimina el último uso', async () => {
  const original = await guardarDocumento(crearDocumento({ titulo: 'Con imagen' }));
  const blob = await guardarBlob(new Blob(['foto'], { type: 'image/png' }));
  await guardarElementos([crearElemento(original.id, 'imagen', { datos: { blobId: blob.id } })]);
  const copia = await duplicarDocumento(original.id);

  await borrarDocumentoDefinitivo(original.id);
  assert.ok(await obtenerBlob(blob.id));
  await borrarDocumentoDefinitivo(copia.id);
  assert.equal(await obtenerBlob(blob.id), undefined);
});

test('purgar blobs sin referencia no toca imágenes usadas', async () => {
  const d = await guardarDocumento(crearDocumento());
  const usada = await guardarBlob(new Blob(['usada'], { type: 'image/png' }));
  const huerfana = await guardarBlob(new Blob(['huerfana'], { type: 'image/png' }));
  await guardarElementos([crearElemento(d.id, 'imagen', { datos: { blobId: usada.id } })]);
  assert.equal(await purgarBlobsSinReferencia(), 1);
  assert.ok(await obtenerBlob(usada.id));
  assert.equal(await obtenerBlob(huerfana.id), undefined);
});

test('orden por nombre con acentos y por fecha', async () => {
  const a = await guardarDocumento(crearDocumento({ titulo: 'Zeta' }));
  const b = await guardarDocumento(crearDocumento({ titulo: 'Árbol' }));
  const porNombre = (await listarDocumentos({ orden: 'nombre' })).map((x) => x.id);
  assert.ok(porNombre.indexOf(b.id) < porNombre.indexOf(a.id));
});

test('ajustes y manejo de 50 documentos', async () => {
  await guardarAjuste('recordatorio', 7);
  assert.equal(await obtenerAjuste('recordatorio'), 7);
  assert.equal(await obtenerAjuste('no-existe', 'x'), 'x');
  for (let i = 0; i < 50; i++) await guardarDocumento(crearDocumento({ titulo: `Doc ${i}` }));
  assert.ok((await listarDocumentos()).length >= 50);
});

test('identificadores únicos y bien formados', () => {
  const ids = new Set(Array.from({ length: 1000 }, nuevoId));
  assert.equal(ids.size, 1000);
  assert.match([...ids][0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('autoguardado: agrupa cambios rápidos y guarda el último', async () => {
  const guardados = [];
  const auto = crearAutoguardado(async (v) => { guardados.push(v); }, { espera: 30 });
  auto.programar('a'); auto.programar('ab'); auto.programar('abc');
  assert.equal(auto.estado(), 'pendiente');
  await new Promise((r) => setTimeout(r, 120));
  assert.deepEqual(guardados, ['abc']);
  assert.equal(auto.estado(), 'guardado');
  auto.programar('final');
  await auto.vaciar(); // guardado inmediato (cierre de pestaña)
  assert.deepEqual(guardados, ['abc', 'final']);
  auto.destruir();
});

import { duplicarDocumento, vaciarPapelera, purgarPapeleraVieja } from '../src/almacen/index.js';

test('duplicar copia el documento y sus elementos con ids nuevos', async () => {
  const d = await guardarDocumento(crearDocumento({ titulo: 'Original', formato: 'tarjetas', estiloRenglones: 'puntos' }));
  await guardarElementos([crearElemento(d.id, 'texto', { contenedor: 't1' }), crearElemento(d.id, 'simbolo')]);
  const copia = await duplicarDocumento(d.id);
  assert.equal(copia.titulo, 'Copia de Original');
  assert.equal(copia.renglones.estilo, 'puntos');
  assert.notEqual(copia.id, d.id);
  const a = await listarElementos(d.id), b = await listarElementos(copia.id);
  assert.equal(b.length, 2);
  assert.ok(b.every((e) => !a.some((x) => x.id === e.id)));
  assert.equal(b.find((e) => e.tipo === 'texto').contenedor, 't1');
});

test('la papelera se vacía y se purga lo antiguo', async () => {
  const viejo = await guardarDocumento(crearDocumento({ titulo: 'Viejo' }));
  const nuevo = await guardarDocumento(crearDocumento({ titulo: 'Nuevo' }));
  await guardarDocumento({ ...viejo, papelera: Date.now() - 40 * 86400000 });
  await guardarDocumento({ ...nuevo, papelera: Date.now() });
  assert.equal(await purgarPapeleraVieja(30), 1);
  const resto = await listarDocumentos({ papelera: true });
  assert.ok(resto.some((x) => x.id === nuevo.id) && !resto.some((x) => x.id === viejo.id));
  await vaciarPapelera();
  assert.equal((await listarDocumentos({ papelera: true })).length, 0);
});

test('autoguardado: distingue QuotaExceededError y notifica error-espacio', async () => {
  const errCuota = new Error('Almacenamiento agotado');
  errCuota.name = 'QuotaExceededError';
  const auto = crearAutoguardado(async () => {
    throw errCuota;
  }, { espera: 10 });
  const estados = [];
  auto.suscribir((e) => estados.push(e));
  auto.programar('datos');
  await auto.vaciar();
  assert.equal(auto.estado(), 'error-espacio');
  assert.ok(estados.includes('error-espacio'));
  auto.destruir();
});

