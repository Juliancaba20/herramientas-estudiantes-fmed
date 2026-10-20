import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { borrarBlob, obtenerBlob, guardarBlob } from '../src/almacen/blobs.js';
import {
  guardarDocumento,
  obtenerDocumento,
  duplicarDocumento,
  borrarDocumentoDefinitivo,
  enviarAPapelera,
  restaurarDePapelera,
  vaciarPapelera,
} from '../src/almacen/documentos.js';
import { guardarElementos, listarElementos } from '../src/almacen/elementos.js';
import { nuevoId, crearElemento, TIPOS_ELEMENTO } from '../src/almacen/modelo.js';
import { marcosDePaginas, paginaEnY, PASO_PAGINA, duplicarElementosPagina } from '../src/formatos/paginas.js';
import { prepararImagenes } from '../src/herramientas/imagenes/recursos.js';

const dom = new JSDOM('<!doctype html><div><canvas></canvas></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = () => 0;
globalThis.createImageBitmap = async () => ({ width: 4000, height: 2000, close() {} });
dom.window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
dom.window.HTMLCanvasElement.prototype.toBlob = (resolver) => resolver(new Blob(['optimized'], { type: 'image/webp' }));
const { Escena } = await import('../src/lienzo/escena.js');
const { Lienzo } = await import('../src/lienzo/motor.js');

const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
let indice = 0;

async function insertarEnFormato(formato, opciones = {}) {
  const contenedorCanvas = document.createElement('div');
  const canvas = document.createElement('canvas');
  contenedorCanvas.appendChild(canvas);
  canvas.getBoundingClientRect = () => rect;
  canvas.parentElement.getBoundingClientRect = () => rect;
  canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {};
  const escena = new Escena();
  const id = `imagen-${formato}-${++indice}`;
  const motor = new Lienzo(canvas, {
    escena, documentoId: id, camara: { x: 0, y: 0, zoom: 1 }, ...opciones,
  });
  const archivo = new dom.window.File([new Uint8Array(5 * 1024 * 1024)], 'foto.png', { type: 'image/png' });
  const posicion = formato === 'paginas' ? { x: 90, y: PASO_PAGINA + 140 } : { x: 90, y: 140 };
  const elemento = await motor.insertarImagen(archivo, posicion);
  assert.ok(elemento);
  assert.equal(elemento.tipo, 'imagen');
  assert.ok(await obtenerBlob(elemento.datos.blobId));
  assert.ok(elemento.ancho <= 2400 && elemento.alto <= 1200);
  assert.equal(elemento.ancho / elemento.alto, 2);
  const preparada = await prepararImagenes([elemento]);
  assert.equal(preparada.imagenes.length, 1);
  preparada.liberar();
  if (formato === 'pizarron') {
    motor.iniciarRecorteImagen();
    motor.recortarImagen({ x: 0.1, y: 0.1, ancho: 0.8, alto: 0.8 });
    motor.terminarRecorteImagen();
    assert.deepEqual(escena.get(elemento.id).datos.recorte, { x: 0.1, y: 0.1, ancho: 0.8, alto: 0.8 });
    motor.deshacer(); assert.equal(escena.get(elemento.id).datos.recorte, undefined);
    motor.rehacer(); assert.deepEqual(escena.get(elemento.id).datos.recorte, { x: 0.1, y: 0.1, ancho: 0.8, alto: 0.8 });
  }
  if (formato === 'pizarron') assert.equal(elemento.contenedor, null);
  if (formato === 'tarjetas') assert.equal(elemento.contenedor, 'tarjeta-1');
  if (formato === 'paginas') assert.equal(elemento.contenedor, 2);
  await borrarBlob(elemento.datos.blobId);
  motor.destruir();
}

test('la inserción de imagen usa el mismo motor en pizarrón, tarjetas y páginas A4', async () => {
  await insertarEnFormato('pizarron');
  await insertarEnFormato('tarjetas', { contenedor: 'tarjeta-1', marco: { x: 0, y: 0, ancho: 600, alto: 400 } });
  await insertarEnFormato('paginas', { contenedor: (y) => paginaEnY(y), marco: marcosDePaginas(2) });
});

test('duplicar documento con imágenes preserva la imagen y no rompe el original al eliminar una copia', async () => {
  const blob = await guardarBlob(new Blob(['datos de imagen de prueba'], { type: 'image/png' }), { nombre: 'diagrama.png' });
  const docOriginal = await guardarDocumento({
    id: nuevoId(),
    titulo: 'Doc con imagen',
    formato: 'pizarron',
    creado: Date.now(),
    modificado: Date.now(),
    papelera: null,
  });

  const elImagen = crearElemento(docOriginal.id, TIPOS_ELEMENTO.IMAGEN, {
    x: 100,
    y: 200,
    ancho: 400,
    alto: 300,
    datos: { blobId: blob.id, nombre: 'diagrama.png', recorte: { x: 0, y: 0, ancho: 1, alto: 1 } },
  });
  await guardarElementos([elImagen]);

  // Duplicar el documento
  const docCopia = await duplicarDocumento(docOriginal.id, 'Copia de Doc con imagen');
  assert.ok(docCopia);
  assert.notEqual(docCopia.id, docOriginal.id);

  // Verificar que la copia tiene la imagen referenciando el mismo blobId
  const elsCopia = await listarElementos(docCopia.id);
  assert.equal(elsCopia.length, 1);
  assert.equal(elsCopia[0].tipo, 'imagen');
  assert.equal(elsCopia[0].datos.blobId, blob.id);
  assert.notEqual(elsCopia[0].id, elImagen.id);
  assert.deepEqual(elsCopia[0].datos.recorte, { x: 0, y: 0, ancho: 1, alto: 1 });

  // Borrar definitivamente la copia
  await borrarDocumentoDefinitivo(docCopia.id);

  // El blob debe seguir existiendo porque el documento original lo sigue usando
  const blobAunExiste = await obtenerBlob(blob.id);
  assert.ok(blobAunExiste, 'El blob debe conservarse porque el documento original lo utiliza');

  // El documento original y su imagen siguen intactos
  const elsOriginal = await listarElementos(docOriginal.id);
  assert.equal(elsOriginal.length, 1);
  assert.equal(elsOriginal[0].datos.blobId, blob.id);

  // Ahora borrar definitivamente el original: no queda nadie usándolo, el blob debe eliminarse
  await borrarDocumentoDefinitivo(docOriginal.id);
  const blobPurgado = await obtenerBlob(blob.id);
  assert.equal(blobPurgado, undefined, 'El blob debe eliminarse automáticamente al no quedar referencias');
});

test('duplicar página A4 duplica también los elementos de imagen con sus datos', () => {
  const elementos = [
    {
      id: 'el-1',
      tipo: 'imagen',
      x: 80,
      y: 120,
      ancho: 300,
      alto: 200,
      datos: { blobId: 'blob-abc', recorte: { x: 0.1, y: 0.1, ancho: 0.8, alto: 0.8 } },
    },
  ];
  let idContador = 100;
  const clonados = duplicarElementosPagina(elementos, 1, 2, () => `id-${++idContador}`, 2);
  assert.equal(clonados.length, 1);
  assert.equal(clonados[0].tipo, 'imagen');
  assert.equal(clonados[0].datos.blobId, 'blob-abc');
  assert.deepEqual(clonados[0].datos.recorte, { x: 0.1, y: 0.1, ancho: 0.8, alto: 0.8 });
  assert.equal(clonados[0].y, 120 + PASO_PAGINA);
});

test('papelera conserva imágenes al enviar y restaurar, y las elimina al vaciar papelera', async () => {
  const blob = await guardarBlob(new Blob(['prueba papelera'], { type: 'image/png' }), { nombre: 'foto-papelera.png' });
  const doc = await guardarDocumento({
    id: nuevoId(),
    titulo: 'Para papelera',
    formato: 'tarjetas',
    creado: Date.now(),
    modificado: Date.now(),
    papelera: null,
  });
  await guardarElementos([
    crearElemento(doc.id, TIPOS_ELEMENTO.IMAGEN, {
      x: 0,
      y: 0,
      ancho: 200,
      alto: 150,
      datos: { blobId: blob.id },
    }),
  ]);

  // Enviar a papelera
  await enviarAPapelera(doc);
  const docEnPapelera = await obtenerDocumento(doc.id);
  assert.ok(docEnPapelera.papelera !== null);
  // El blob sigue disponible
  assert.ok(await obtenerBlob(blob.id));

  // Restaurar
  await restaurarDePapelera(docEnPapelera);
  const docRestaurado = await obtenerDocumento(doc.id);
  assert.equal(docRestaurado.papelera, null);
  assert.ok(await obtenerBlob(blob.id));

  // Enviar nuevamente y vaciar papelera
  await enviarAPapelera(docRestaurado);
  await vaciarPapelera();

  // El documento y el blob han sido eliminados sin dejar huérfanos
  assert.equal(await obtenerDocumento(doc.id), undefined);
  assert.equal(await obtenerBlob(blob.id), undefined);
});
