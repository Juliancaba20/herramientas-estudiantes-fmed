import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  ALTO_A4, ANCHO_A4, cabeEnPagina, cambiosEliminarPagina, desbordeDePagina, duplicarElementosPagina, elementosDePagina, marcoDePagina, marcosDePaginas, moverElementoAPagina, normalizarPaginasConfig, paginaDeElemento, paginaEnY, PASO_PAGINA,
} from '../src/formatos/paginas.js';
import { crearElemento, TIPOS_ELEMENTO } from '../src/almacen/modelo.js';

const dom = new JSDOM('<!doctype html><div id="c"><canvas id="cv" tabindex="0"></canvas></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
const { Escena } = await import('../src/lienzo/escena.js');
const { Lienzo } = await import('../src/lienzo/motor.js');

const canvas = dom.window.document.getElementById('cv');
const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
canvas.getBoundingClientRect = () => rect;
canvas.parentElement.getBoundingClientRect = () => rect;
canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {};
const falso = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
canvas.getContext = falso;
dom.window.HTMLCanvasElement.prototype.getContext = falso;

test('marcoDePagina genera las dimensiones A4 estándar y posición vertical correcta', () => {
  const p1 = marcoDePagina(1);
  assert.equal(p1.ancho, ANCHO_A4);
  assert.equal(p1.alto, ALTO_A4);
  assert.equal(p1.x, 0);
  assert.equal(p1.y, 0);
  assert.equal(p1.numero, 1);

  const p2 = marcoDePagina(2);
  assert.equal(p2.x, 0);
  assert.equal(p2.y, PASO_PAGINA);
  assert.equal(p2.ancho, ANCHO_A4);
  assert.equal(p2.alto, ALTO_A4);
  assert.equal(p2.numero, 2);
});

test('marcosDePaginas devuelve la lista de marcos continuos', () => {
  const marcos = marcosDePaginas(3);
  assert.equal(marcos.length, 3);
  assert.equal(marcos[0].numero, 1);
  assert.equal(marcos[1].numero, 2);
  assert.equal(marcos[2].numero, 3);
  assert.equal(marcos[2].y, 2 * PASO_PAGINA);
});

test('paginaEnY calcula correctamente el número de página según la coordenada Y', () => {
  assert.equal(paginaEnY(0), 1);
  assert.equal(paginaEnY(500), 1);
  assert.equal(paginaEnY(ALTO_A4), 1);
  assert.equal(paginaEnY(PASO_PAGINA), 2);
  assert.equal(paginaEnY(PASO_PAGINA + 200), 2);
  assert.equal(paginaEnY(2 * PASO_PAGINA + 10), 3);
});

test('normalizarPaginasConfig asegura cantidad mínima de páginas y acota activa', () => {
  const c1 = normalizarPaginasConfig({});
  assert.equal(c1.cantidadPaginas, 1);
  assert.equal(c1.paginaActiva, 1);
  assert.equal(c1.imprimirRenglones, false);

  const c2 = normalizarPaginasConfig({ cantidadPaginas: 4, paginaActiva: 10 });
  assert.equal(c2.cantidadPaginas, 4);
  assert.equal(c2.paginaActiva, 4); // acotada al máximo de páginas
});

test('elementosDePagina filtra por contenedor numérico o posición en el mundo', () => {
  const el1 = crearElemento('doc_a4', TIPOS_ELEMENTO.TEXTO, { y: 100, contenedor: 1 });
  const el2 = crearElemento('doc_a4', TIPOS_ELEMENTO.FIGURA, { y: PASO_PAGINA + 50, contenedor: 2 });
  const elSinContenedor = crearElemento('doc_a4', TIPOS_ELEMENTO.TRAZO, { y: PASO_PAGINA + 120, contenedor: null });

  const enP1 = elementosDePagina([el1, el2, elSinContenedor], 1);
  assert.equal(enP1.length, 1);
  assert.equal(enP1[0].id, el1.id);

  const enP2 = elementosDePagina([el1, el2, elSinContenedor], 2);
  assert.equal(enP2.length, 2);
  assert.ok(enP2.some((e) => e.id === el2.id));
  assert.ok(enP2.some((e) => e.id === elSinContenedor.id));
});

test('duplicarElementosPagina clona y traslada verticalmente los elementos a la nueva página', () => {
  let contador = 0;
  const nuevoId = () => `clon_${++contador}`;

  const elTrazo = crearElemento('doc_a4', TIPOS_ELEMENTO.TRAZO, {
    y: 100,
    contenedor: 1,
    datos: { puntos: [[50, 100, 0.5], [60, 110, 0.5]] },
  });
  const elTexto = crearElemento('doc_a4', TIPOS_ELEMENTO.TEXTO, {
    y: 200,
    contenedor: 1,
    datos: { bloques: [] },
  });

  const clonados = duplicarElementosPagina([elTrazo, elTexto], 1, 2, nuevoId);
  assert.equal(clonados.length, 2);

  const trazoClon = clonados.find((e) => e.tipo === 'trazo');
  assert.equal(trazoClon.contenedor, 2);
  assert.equal(trazoClon.y, 100 + PASO_PAGINA);
  assert.equal(trazoClon.datos.puntos[0][1], 100 + PASO_PAGINA);

  const textoClon = clonados.find((e) => e.tipo === 'texto');
  assert.equal(textoClon.contenedor, 2);
  assert.equal(textoClon.y, 200 + PASO_PAGINA);
});

test('el motor Lienzo resuelve dinámicamente el contenedor de página según la coordenada Y', () => {
  const escena = new Escena();
  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc_paginas_a4',
    contenedor: (y) => paginaEnY(y),
    marco: marcosDePaginas(2),
  });

  // Crear figura en la página 1 (y = 100)
  motor.setHerramienta('rectangulo');
  const eDown1 = new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 });
  Object.defineProperty(eDown1, 'pointerId', { value: 1 });
  canvas.dispatchEvent(eDown1);

  const eMove1 = new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 });
  Object.defineProperty(eMove1, 'pointerId', { value: 1 });
  canvas.dispatchEvent(eMove1);

  const eUp1 = new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 });
  Object.defineProperty(eUp1, 'pointerId', { value: 1 });
  canvas.dispatchEvent(eUp1);

  // Mover cámara a la página 2 y dibujar figura en página 2
  motor.camara = { x: 0, y: PASO_PAGINA, zoom: 1 };
  motor.setHerramienta('rectangulo');
  const eDown2 = new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 });
  Object.defineProperty(eDown2, 'pointerId', { value: 2 });
  canvas.dispatchEvent(eDown2);

  const eMove2 = new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 });
  Object.defineProperty(eMove2, 'pointerId', { value: 2 });
  canvas.dispatchEvent(eMove2);

  const eUp2 = new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 });
  Object.defineProperty(eUp2, 'pointerId', { value: 2 });
  canvas.dispatchEvent(eUp2);

  const figuras = escena.lista().filter((e) => e.tipo === 'figura');
  assert.equal(figuras.length, 2);
  assert.equal(figuras[0].contenedor, 1);
  assert.equal(figuras[1].contenedor, 2);

  motor.destruir();
});


test('la página de un elemento se decide por su posición actual, aunque lo hayan movido o cruce un borde', () => {
  const movido = crearElemento('d', TIPOS_ELEMENTO.TRAZO, { y: PASO_PAGINA + 10, alto: 40, contenedor: 1 }); // contenedor viejo
  assert.equal(paginaDeElemento(movido), 2);
  const cruza = crearElemento('d', TIPOS_ELEMENTO.TRAZO, { y: ALTO_A4 - 100, alto: 200 }); // empieza en la hoja 1, el centro cae en el hueco entre hojas
  assert.equal(paginaDeElemento(cruza), 1);
  assert.deepEqual(elementosDePagina([movido, cruza], 2).map((e) => e.id), [movido.id]);
});

test('el desborde respeta el área imprimible y moverlo coloca el bloque en la página siguiente', () => {
  const texto = crearElemento('d', TIPOS_ELEMENTO.TEXTO, { x: 40, y: 980, ancho: 600, alto: 180, datos: { bloques: [] } });
  assert.deepEqual(desbordeDePagina(texto), { pagina: 1, superior: false, inferior: true, izquierdo: true, derecho: false });
  assert.equal(cabeEnPagina(texto), true);
  assert.equal(cabeEnPagina({ ...texto, alto: ALTO_A4 }), false);
  assert.equal(cabeEnPagina({ ...texto, ancho: ANCHO_A4 }), false);
  const siguiente = moverElementoAPagina(texto, 2);
  assert.equal(siguiente.id, texto.id);
  assert.equal(siguiente.x, 60);
  assert.equal(siguiente.y, PASO_PAGINA + 60);
  assert.equal(siguiente.contenedor, 2);
  assert.equal(siguiente.datos, texto.datos);
});

test('la última página recoge también lo que quedó más abajo', () => {
  const abajo = crearElemento('d', TIPOS_ELEMENTO.FIGURA, { y: 5 * PASO_PAGINA, alto: 10 });
  assert.equal(elementosDePagina([abajo], 2, 2).length, 1);
  assert.equal(elementosDePagina([abajo], 2, 3).length, 0);
});

test('eliminar una página borra la suya y sube las siguientes', () => {
  const e1 = crearElemento('d', TIPOS_ELEMENTO.TEXTO, { y: 100, alto: 30 });
  const e2 = crearElemento('d', TIPOS_ELEMENTO.TEXTO, { y: PASO_PAGINA + 100, alto: 30 });
  const t3 = crearElemento('d', TIPOS_ELEMENTO.TRAZO, { y: 2 * PASO_PAGINA + 50, alto: 10, datos: { puntos: [[0, 2 * PASO_PAGINA + 50, 1]] } });
  const cambios = cambiosEliminarPagina([e1, e2, t3], 2, 3);
  const borra = cambios.find((c) => c.id === e2.id);
  assert.equal(borra.despues, null);
  assert.equal(cambios.some((c) => c.id === e1.id), false);
  const sube = cambios.find((c) => c.id === t3.id).despues;
  assert.equal(sube.y, PASO_PAGINA + 50);
  assert.equal(sube.datos.puntos[0][1], PASO_PAGINA + 50);
  assert.equal(sube.contenedor, 2);
});

test('deshacer y rehacer devuelven la cantidad de páginas junto con los elementos', async () => {
  const { Escena } = await import('../src/lienzo/escena.js');
  const escena = new Escena();
  let cantidad = 1;
  escena.alMeta = (m) => { cantidad = m.cantidadPaginas; };
  // agregar una hoja vacía: no cambia elementos, pero queda en el historial
  cantidad = 2; escena.registrar([], 'pagina', { antes: { cantidadPaginas: 1 }, despues: { cantidadPaginas: 2 } });
  assert.equal(escena.historial.puedeDeshacer(), true);
  escena.deshacer(); assert.equal(cantidad, 1);
  escena.rehacer(); assert.equal(cantidad, 2);
  // eliminar con contenido: deshacer devuelve el elemento y la hoja
  const el = crearElemento('d', TIPOS_ELEMENTO.TEXTO, { y: PASO_PAGINA + 20, alto: 20 });
  const e2 = new Escena([el]); let c2 = 2; e2.alMeta = (m) => { c2 = m.cantidadPaginas; };
  e2.ejecutar(cambiosEliminarPagina(e2.lista(), 2, 2), 'borrar', { antes: { cantidadPaginas: 2 }, despues: { cantidadPaginas: 1 } });
  c2 = 1; assert.equal(e2.lista().length, 0);
  e2.deshacer(); assert.equal(c2, 2); assert.equal(e2.lista().length, 1);
});

test('el historial restaura la página activa al crear una hoja desde un desborde', () => {
  const escena = new Escena();
  let cantidad = 1, activa = 1;
  escena.alMeta = (m) => {
    cantidad = m.cantidadPaginas;
    activa = Math.max(1, Math.min(cantidad, m.paginaActiva || activa));
  };
  cantidad = 2; activa = 2;
  escena.registrar([], 'mover texto a página siguiente', {
    antes: { cantidadPaginas: 1, paginaActiva: 1 },
    despues: { cantidadPaginas: 2, paginaActiva: 2 },
  });
  escena.deshacer(); assert.deepEqual([cantidad, activa], [1, 1]);
  escena.rehacer(); assert.deepEqual([cantidad, activa], [2, 2]);
});

test('construirHojasPaginas arma las hojas A4, asigna tamaño al canvas con factor y muestra títulos como texto', async () => {
  const { construirHojasPaginas } = await import('../src/formatos/impresion.js');
  const cont = document.createElement('div');
  const llamadas = [];
  const factor = 3;
  const hojas = construirHojasPaginas(cont, {
    cantidad: 3,
    titulo: '<b>Biología</b> <img src=x onerror=alert(1)>',
    factor,
    dibujarEn: (cv, num, idx, f) => llamadas.push([num, idx, cv.width, cv.height, f]),
  });

  assert.equal(hojas, 3);
  const elementosHoja = cont.querySelectorAll('.nt-pagina-impresa');
  assert.equal(elementosHoja.length, 3);

  const canvases = cont.querySelectorAll('canvas');
  assert.equal(canvases.length, 3);
  assert.equal(canvases[0].width, 794 * factor);
  assert.equal(canvases[0].height, 1123 * factor);

  // Seguridad contra XSS: los títulos con etiquetas HTML deben insertarse como texto
  assert.equal(cont.querySelector('img'), null, 'no debe interpretar tags de imagen en el título');
  assert.equal(cont.querySelector('b'), null, 'no debe interpretar tags de formato en el título');
  assert.ok(cont.querySelector('.nt-pagina-impresa__rotulo').textContent.includes('<b>Biología</b>'));
  assert.ok(cont.querySelector('.nt-pagina-impresa__rotulo').textContent.includes('<img src=x'));

  // Verificación de callback con número de página (1-based), índice (0-based) y factor
  assert.deepEqual(llamadas[0], [1, 0, 794 * factor, 1123 * factor, factor]);
  assert.deepEqual(llamadas[1], [2, 1, 794 * factor, 1123 * factor, factor]);
  assert.deepEqual(llamadas[2], [3, 2, 794 * factor, 1123 * factor, factor]);

  // Si se pasa una sola página (por ejemplo en modo de impresión actual)
  const contUna = document.createElement('div');
  const unaHoja = construirHojasPaginas(contUna, {
    cantidad: 1,
    paginas: [2],
    titulo: 'Documento',
    factor: 2,
    dibujarEn: () => {},
  });
  assert.equal(unaHoja, 1);
  const cvUna = contUna.querySelector('canvas');
  assert.equal(cvUna.width, 794 * 2);
  assert.equal(cvUna.height, 1123 * 2);
  assert.ok(contUna.querySelector('.nt-pagina-impresa__rotulo').textContent.includes('Página 2'));
});

