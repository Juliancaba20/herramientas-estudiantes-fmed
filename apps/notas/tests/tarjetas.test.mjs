// Pruebas unitarias para el formato Tarjetas (Etapa 9).
import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  calcularDestinoArrastre, distribucionHoja, duplicarElementosTarjeta, elementosDeTarjeta, medidasTarjeta, moverTarjeta, normalizarPersonalizado, normalizarTarjetasConfig, PROPORCIONES_TARJETA, tamanoImpreso,
} from '../src/formatos/tarjetas.js';
import { crearElemento, TIPOS_ELEMENTO } from '../src/almacen/modelo.js';
import {
  crearDocumento, guardarDocumento, guardarElementos, guardarPendientesDeEscena, listarElementos,
} from '../src/almacen/index.js';
import { asignarHuerfanos } from '../src/formatos/tarjetas.js';
import { aplicarOperacion, crearHistorialTarjetas, crearOperacion } from '../src/formatos/historialTarjetas.js';
import {
  moverEstudio, pasoPorDeslizamiento, pasoPorTecla, pasoPorToque,
} from '../src/formatos/estudio.js';

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

test('medidasTarjeta devuelve las proporciones correctas para 16:9, 4:3, A6 y A5', () => {
  assert.equal(medidasTarjeta('16:9').ancho, 1120);
  assert.equal(medidasTarjeta('16:9').alto, 630);
  assert.equal(medidasTarjeta('4:3').ancho, 960);
  assert.equal(medidasTarjeta('A6').ancho, 740);
  assert.equal(medidasTarjeta('A5').ancho, 1050);
  // Por defecto devuelve 16:9 si se pasa un valor desconocido
  assert.deepEqual(medidasTarjeta('desconocido'), PROPORCIONES_TARJETA['16:9']);
});

test('normalizarTarjetasConfig crea al menos una tarjeta y establece la activa', () => {
  const norm = normalizarTarjetasConfig({});
  assert.equal(norm.tarjetas.length, 1);
  assert.equal(norm.tarjetas[0].titulo, 'Tarjeta 1');
  assert.equal(norm.tarjetaActiva, norm.tarjetas[0].id);
  assert.equal(norm.tamano, '16:9');
  assert.equal(norm.imprimirRenglones, false);
});

test('normalizarTarjetasConfig conserva tarjetas existentes y corrige tarjeta activa inexistente', () => {
  const conf = {
    tamano: 'A6',
    tarjetas: [{ id: 't1', titulo: 'Concepto A' }, { id: 't2', titulo: 'Concepto B' }],
    tarjetaActiva: 't-invalida',
    imprimirRenglones: true,
  };
  const norm = normalizarTarjetasConfig(conf);
  assert.equal(norm.tarjetas.length, 2);
  assert.equal(norm.tamano, 'A6');
  assert.equal(norm.tarjetaActiva, 't1'); // se reasigna a la primera existente
  assert.equal(norm.imprimirRenglones, true);
});

test('elementosDeTarjeta filtra por contenedor y asocia los huérfanos a la primera tarjeta', () => {
  const el1 = crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, { contenedor: 't1' });
  const el2 = crearElemento('doc1', TIPOS_ELEMENTO.TEXTO, { contenedor: 't2' });
  const elHuerfano = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { contenedor: null });

  const deT1 = elementosDeTarjeta([el1, el2, elHuerfano], 't1', true);
  assert.equal(deT1.length, 2);
  assert.ok(deT1.some((e) => e.id === el1.id));
  assert.ok(deT1.some((e) => e.id === elHuerfano.id));

  const deT2 = elementosDeTarjeta([el1, el2, elHuerfano], 't2', false);
  assert.equal(deT2.length, 1);
  assert.equal(deT2[0].id, el2.id);
});

test('duplicarElementosTarjeta clona todos los elementos con nuevo ID y nuevo contenedor', () => {
  const el1 = crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, { contenedor: 't1', datos: { color: '#000' } });
  const el2 = crearElemento('doc1', TIPOS_ELEMENTO.FIGURA, { contenedor: 't2' });

  const duplicados = duplicarElementosTarjeta([el1, el2], 't1', 't3');
  assert.equal(duplicados.length, 1);
  assert.notEqual(duplicados[0].id, el1.id);
  assert.equal(duplicados[0].contenedor, 't3');
  assert.equal(duplicados[0].datos.color, '#000');
});

test('el motor Lienzo asocia contenedor a los elementos creados (trazo, figura, texto)', () => {
  const escena = new Escena();
  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc_tarjetas',
    contenedor: 'tarjeta_alpha',
    marco: { x: 0, y: 0, ancho: 1120, alto: 630 },
  });

  // Crear figura
  motor.setHerramienta('rectangulo');
  const eDown = new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 });
  Object.defineProperty(eDown, 'pointerId', { value: 1 });
  canvas.dispatchEvent(eDown);

  const eMove = new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 });
  Object.defineProperty(eMove, 'pointerId', { value: 1 });
  canvas.dispatchEvent(eMove);

  const eUp = new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 });
  Object.defineProperty(eUp, 'pointerId', { value: 1 });
  canvas.dispatchEvent(eUp);

  const figuras = escena.lista().filter((e) => e.tipo === 'figura');
  assert.equal(figuras.length, 1);
  assert.equal(figuras[0].contenedor, 'tarjeta_alpha');

  // Cambiar contenedor
  motor.setContenedor('tarjeta_beta');
  assert.equal(motor.contenedor, 'tarjeta_beta');

  motor.destruir();
});

test('las medidas físicas de A6 y A5 coinciden con el papel (5 unidades = 1 mm)', () => {
  const a6 = medidasTarjeta('A6');
  assert.deepEqual([a6.anchoMm, a6.altoMm], [148, 105]);
  const a5 = medidasTarjeta('A5');
  assert.deepEqual([a5.anchoMm, a5.altoMm], [210, 148]);
});

test('el tamaño personalizado se da en milímetros y se acota', () => {
  const m = medidasTarjeta('personalizado', { anchoMm: 120, altoMm: 80 });
  assert.deepEqual([m.ancho, m.alto, m.anchoMm, m.altoMm], [600, 400, 120, 80]);
  const c = normalizarTarjetasConfig({ tamano: 'personalizado', personalizado: { anchoMm: 5, altoMm: 9999 } });
  assert.equal(c.tamano, 'personalizado');
  assert.deepEqual(c.personalizado, { anchoMm: 40, altoMm: 400 });
  assert.equal(normalizarTarjetasConfig({}).personalizado.anchoMm, 150);
});

test('moverTarjeta reordena sin perder tarjetas y respeta los límites', () => {
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(moverTarjeta(l, 0, 2).map((t) => t.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moverTarjeta(l, 3, 0).map((t) => t.id), ['d', 'a', 'b', 'c']);
  assert.equal(moverTarjeta(l, 1, 1), l);
  assert.equal(moverTarjeta(l, -1, 2), l);
  assert.equal(moverTarjeta(l, 0, 9), l);
});

test('tarjetas por hoja: 1, 2, 4 o 6, con valores inválidos tratados como 1', () => {
  assert.deepEqual(distribucionHoja(2), { columnas: 1, filas: 2, porHoja: 2 });
  assert.deepEqual(distribucionHoja(4), { columnas: 2, filas: 2, porHoja: 4 });
  assert.deepEqual(distribucionHoja(6), { columnas: 2, filas: 3, porHoja: 6 });
  assert.equal(distribucionHoja(5).porHoja, 1);
  assert.equal(normalizarTarjetasConfig({ porHoja: 3 }).porHoja, 1);
  assert.equal(normalizarTarjetasConfig({ porHoja: 6 }).porHoja, 6);
});

test('una A6 sale a tamaño real hasta 2 por hoja; una A5 sola se reduce lo justo; nunca se agranda', () => {
  const a6 = medidasTarjeta('A6');
  assert.equal(tamanoImpreso(a6, 1).escala, 1);
  assert.equal(tamanoImpreso(a6, 2).escala, 1);
  const a5 = tamanoImpreso(medidasTarjeta('A5'), 1);
  assert.ok(a5.escala < 1 && a5.anchoMm <= 198, 'A5 (210 mm) no cabe con márgenes: se reduce');
  const apretada = tamanoImpreso(medidasTarjeta('16:9'), 6);
  assert.ok(apretada.anchoMm <= 95 && apretada.escala < 0.5);
});

test('construirHojasTarjetas arma las hojas, usa texto plano y agrega marcas de corte', async () => {
  const { construirHojasTarjetas } = await import('../src/formatos/impresion.js');
  const cont = document.createElement('div');
  const tarjetas = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, titulo: i === 0 ? '<img src=x onerror=alert(1)>' : `T${i}` }));
  const llamadas = [];
  const hojas = construirHojasTarjetas(cont, {
    tarjetas, med: medidasTarjeta('A6'), porHoja: 2, marcas: true, titulo: '<b>Doc</b>', factor: 2,
    dibujarEn: (cv, t, idx, f) => llamadas.push([t.id, idx, cv.width, cv.height, f]),
  });
  assert.equal(hojas, 3); // 5 tarjetas a 2 por hoja
  assert.equal(cont.querySelectorAll('.nt-tarjeta-impresa').length, 5);
  assert.equal(cont.querySelectorAll('.nt-marca').length, 20);
  assert.equal(cont.querySelector('img'), null, 'los títulos no se interpretan como HTML');
  assert.ok(cont.querySelector('.nt-tarjeta-impresa__rotulo').textContent.includes('<img src=x'));
  assert.deepEqual(llamadas[0], ['t0', 0, 1480, 1050, 2]);
  const sin = construirHojasTarjetas(cont, { tarjetas, med: medidasTarjeta('A6'), porHoja: 1, marcas: false, titulo: 'D', factor: 1, dibujarEn: () => {} });
  assert.equal(sin, 5);
  assert.equal(cont.querySelectorAll('.nt-marca').length, 0);
});

test('configuración persistida de tarjetas: porHoja y marcasDeCorte se normalizan y mantienen sus valores', () => {
  const c1 = normalizarTarjetasConfig({});
  assert.equal(c1.porHoja, 1);
  assert.equal(c1.marcasDeCorte, false);

  const c2 = normalizarTarjetasConfig({ porHoja: 4, marcasDeCorte: true });
  assert.equal(c2.porHoja, 4);
  assert.equal(c2.marcasDeCorte, true);

  const c3 = normalizarTarjetasConfig({ porHoja: 2, marcasDeCorte: false });
  assert.equal(c3.porHoja, 2);
  assert.equal(c3.marcasDeCorte, false);

  const cInvalido = normalizarTarjetasConfig({ porHoja: 'muchas', marcasDeCorte: 1 });
  assert.equal(cInvalido.porHoja, 1);
  assert.equal(cInvalido.marcasDeCorte, true);
});

test('12 tarjetas A6 generan la cantidad exacta de hojas (12, 6, 3 y 2) según porHoja', async () => {
  const { construirHojasTarjetas } = await import('../src/formatos/impresion.js');
  const tarjetas12 = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, titulo: `Tarjeta ${i + 1}` }));
  const a6 = medidasTarjeta('A6');

  const cont1 = document.createElement('div');
  assert.equal(construirHojasTarjetas(cont1, { tarjetas: tarjetas12, med: a6, porHoja: 1, marcas: false, titulo: 'Doc', factor: 1, dibujarEn: () => {} }), 12);
  assert.equal(cont1.querySelectorAll('.nt-hoja-tarjetas').length, 12);

  const cont2 = document.createElement('div');
  assert.equal(construirHojasTarjetas(cont2, { tarjetas: tarjetas12, med: a6, porHoja: 2, marcas: false, titulo: 'Doc', factor: 1, dibujarEn: () => {} }), 6);
  assert.equal(cont2.querySelectorAll('.nt-hoja-tarjetas').length, 6);

  const cont4 = document.createElement('div');
  assert.equal(construirHojasTarjetas(cont4, { tarjetas: tarjetas12, med: a6, porHoja: 4, marcas: true, titulo: 'Doc', factor: 1, dibujarEn: () => {} }), 3);
  assert.equal(cont4.querySelectorAll('.nt-hoja-tarjetas').length, 3);
  assert.equal(cont4.querySelectorAll('.nt-marca').length, 12 * 4);

  const cont6 = document.createElement('div');
  assert.equal(construirHojasTarjetas(cont6, { tarjetas: tarjetas12, med: a6, porHoja: 6, marcas: false, titulo: 'Doc', factor: 1, dibujarEn: () => {} }), 2);
  assert.equal(cont6.querySelectorAll('.nt-hoja-tarjetas').length, 2);
});

test('normalización del tamaño personalizado valida rango 40-400 mm y descarta entradas no válidas', () => {
  const n1 = normalizarPersonalizado({ anchoMm: 120, altoMm: 80 });
  assert.deepEqual(n1, { anchoMm: 120, altoMm: 80 });

  const nBajo = normalizarPersonalizado({ anchoMm: 20, altoMm: 35 });
  assert.equal(nBajo.anchoMm, 40);
  assert.equal(nBajo.altoMm, 40);

  const nAlto = normalizarPersonalizado({ anchoMm: 550, altoMm: 900 });
  assert.equal(nAlto.anchoMm, 400);
  assert.equal(nAlto.altoMm, 400);

  const nInvalido = normalizarPersonalizado({ anchoMm: 'no-numero', altoMm: null });
  assert.equal(nInvalido.anchoMm, 150);
  assert.equal(nInvalido.altoMm, 100);

  const nVacio = normalizarPersonalizado({});
  assert.equal(nVacio.anchoMm, 150);
  assert.equal(nVacio.altoMm, 100);
});

test('la configuración de un documento con tamaño personalizado se conserva al normalizarla', () => {
  const cfg = normalizarTarjetasConfig({
    tamano: 'personalizado',
    personalizado: { anchoMm: 120, altoMm: 80 },
  });
  assert.equal(cfg.tamano, 'personalizado');
  assert.deepEqual(cfg.personalizado, { anchoMm: 120, altoMm: 80 });

  const med = medidasTarjeta(cfg.tamano, cfg.personalizado);
  assert.equal(med.anchoMm, 120);
  assert.equal(med.altoMm, 80);
  assert.equal(med.ancho, 120 * 5); // 600 px (5 px por mm)
  assert.equal(med.alto, 80 * 5);   // 400 px
  assert.ok(med.nombre.includes('120 × 80 mm'));
});

test('alternar de tamaño personalizado a A6 y volver a personalizado conserva las dimensiones y no altera elementos', () => {
  // Configuración inicial personalizada 120x80
  const cfgInicial = normalizarTarjetasConfig({
    tamano: 'personalizado',
    personalizado: { anchoMm: 120, altoMm: 80 },
  });
  assert.equal(cfgInicial.tamano, 'personalizado');
  assert.deepEqual(cfgInicial.personalizado, { anchoMm: 120, altoMm: 80 });

  // Escena con un elemento en la tarjeta
  const el = crearElemento('doc1', TIPOS_ELEMENTO.TRAZO, {
    contenedor: cfgInicial.tarjetas[0].id,
    datos: { puntos: [{ x: 50, y: 50 }, { x: 100, y: 100 }] },
  });
  const escena = new Escena([el]);
  const motor = new Lienzo(canvas, {
    escena,
    documentoId: 'doc1',
    contenedor: cfgInicial.tarjetas[0].id,
    marco: { x: 0, y: 0, ancho: 120 * 5, alto: 80 * 5 },
  });

  // Cambiar a A6
  const medA6 = medidasTarjeta('A6', cfgInicial.personalizado);
  motor.setMarco({ x: 0, y: 0, ancho: medA6.ancho, alto: medA6.alto });
  assert.equal(motor.marco.ancho, 740);
  assert.equal(motor.marco.alto, 525);
  // Los elementos no se tocan
  assert.equal(escena.lista().length, 1);
  assert.deepEqual(escena.lista()[0].datos.puntos, [{ x: 50, y: 50 }, { x: 100, y: 100 }]);

  // Volver a personalizado
  const medPers = medidasTarjeta('personalizado', cfgInicial.personalizado);
  motor.setMarco({ x: 0, y: 0, ancho: medPers.ancho, alto: medPers.alto });
  assert.equal(motor.marco.ancho, 600);
  assert.equal(motor.marco.alto, 400);
  assert.equal(escena.lista().length, 1);
  assert.deepEqual(escena.lista()[0].datos.puntos, [{ x: 50, y: 50 }, { x: 100, y: 100 }]);

  motor.destruir();
});

test('calcularDestinoArrastre calcula correctamente el índice en disposición vertical (tira)', () => {
  // 4 elementos verticales de 100 px de alto con 10 px de separación
  const rects = [
    { top: 0, bottom: 100, height: 100, left: 10, right: 150 },   // centro y: 50
    { top: 110, bottom: 210, height: 100, left: 10, right: 150 }, // centro y: 160
    { top: 220, bottom: 320, height: 100, left: 10, right: 150 }, // centro y: 270
    { top: 330, bottom: 430, height: 100, left: 10, right: 150 }, // centro y: 380
  ];

  // Puntero arriba del primer elemento
  assert.equal(calcularDestinoArrastre(rects, { x: 50, y: -20 }), 0);
  assert.equal(calcularDestinoArrastre(rects, 10), 0);

  // Puntero entre 0 y 1, más cerca de 0 (y = 80, dist 30 a 50 vs 80 a 160)
  assert.equal(calcularDestinoArrastre(rects, { x: 50, y: 80 }), 0);

  // Puntero entre 0 y 1, más cerca de 1 (y = 140, dist 90 a 50 vs 20 a 160)
  assert.equal(calcularDestinoArrastre(rects, { x: 50, y: 140 }), 1);

  // Puntero cerca del elemento 2 (y = 260)
  assert.equal(calcularDestinoArrastre(rects, 260), 2);

  // Puntero después del último elemento (y = 500)
  assert.equal(calcularDestinoArrastre(rects, { x: 50, y: 500 }), 3);

  // Lista vacía o de 1 elemento
  assert.equal(calcularDestinoArrastre([], 50), 0);
  assert.equal(calcularDestinoArrastre([{ top: 10, bottom: 90 }], 200), 0);
});

test('calcularDestinoArrastre calcula el elemento más cercano en cuadrícula 2D', () => {
  // Rejilla 2x2
  // Fila 0: [0, 0]-[100, 100] (centro 50, 50) y [110, 0]-[210, 100] (centro 160, 50)
  // Fila 1: [0, 110]-[100, 210] (centro 50, 160) y [110, 110]-[210, 210] (centro 160, 160)
  const rects = [
    { left: 0, right: 100, top: 0, bottom: 100 },     // 0: arriba-izq (50, 50)
    { left: 110, right: 210, top: 0, bottom: 100 },   // 1: arriba-der (160, 50)
    { left: 0, right: 100, top: 110, bottom: 210 },   // 2: abajo-izq (50, 160)
    { left: 110, right: 210, top: 110, bottom: 210 }, // 3: abajo-der (160, 160)
  ];

  assert.equal(calcularDestinoArrastre(rects, { x: 40, y: 40 }), 0);
  assert.equal(calcularDestinoArrastre(rects, { x: 180, y: 30 }), 1);
  assert.equal(calcularDestinoArrastre(rects, { x: 30, y: 170 }), 2);
  assert.equal(calcularDestinoArrastre(rects, { x: 155, y: 165 }), 3);
});

test('reordenar con moverTarjeta conserva las tarjetas y mantiene la tarjeta activa sin cambios', () => {
  const tarjetas = [
    { id: 't1', titulo: 'Primera' },
    { id: 't2', titulo: 'Segunda' },
    { id: 't3', titulo: 'Tercera' },
    { id: 't4', titulo: 'Cuarta' },
  ];

  // Mover tarjeta 0 a posición 2
  const reordenada1 = moverTarjeta(tarjetas, 0, 2);
  assert.deepEqual(
    reordenada1.map((t) => t.id),
    ['t2', 't3', 't1', 't4'],
  );

  // Mover tarjeta 3 a posición 0
  const reordenada2 = moverTarjeta(reordenada1, 3, 0);
  assert.deepEqual(
    reordenada2.map((t) => t.id),
    ['t4', 't2', 't3', 't1'],
  );

  // Configuración normalizada: la tarjeta activa se define por su id y no se pierde ni cambia
  const cfg = normalizarTarjetasConfig({
    tarjetas: reordenada2,
    tarjetaActiva: 't3',
  });
  assert.equal(cfg.tarjetaActiva, 't3');
  assert.equal(cfg.tarjetas[3].id, 't1');
  assert.equal(cfg.tarjetas[2].id, 't3');
});





// ---------------------------------------------------------------------------------------------
// Bloque A: autoguardado de la escena vigente (error de pérdida de datos al cambiar de tarjeta)
// ---------------------------------------------------------------------------------------------
test('el autoguardado guarda lo escrito en la tarjeta 2 después de cambiar de escena', async () => {
  const d = await guardarDocumento(crearDocumento({ titulo: 'Dos tarjetas', formato: 'tarjetas' }));
  const idT1 = 't1'; const idT2 = 't2';
  const escena1 = new Escena([]);
  const escena2 = new Escena([]);
  let vigente = escena1; // lo que el motor tiene en cada momento
  const obtener = () => vigente;

  // Se escribe en la tarjeta 1 y el autoguardado funciona (como al abrir el documento)
  const enT1 = crearElemento(d.id, TIPOS_ELEMENTO.TEXTO, { contenedor: idT1, datos: { contenido: 'uno' } });
  escena1.ejecutar([{ id: enT1.id, antes: null, despues: enT1 }], 'crear');
  assert.equal((await guardarPendientesDeEscena(obtener)).guardados, 1);

  // El usuario cambia a la tarjeta 2 (el motor recibe otra escena) y dibuja allí
  vigente = escena2;
  const trazo = crearElemento(d.id, TIPOS_ELEMENTO.TRAZO, { x: 5, y: 5, ancho: 10, alto: 10, contenedor: idT2, datos: { puntos: [[5, 5, 1], [15, 15, 1]], color: '#000', grosor: 3, opacidad: 1 } });
  escena2.ejecutar([{ id: trazo.id, antes: null, despues: trazo }], 'crear');

  const r = await guardarPendientesDeEscena(obtener);
  assert.equal(r.guardados, 1);
  const guardados = await listarElementos(d.id);
  assert.equal(guardados.length, 2);
  assert.equal(guardados.find((e) => e.id === trazo.id)?.contenedor, idT2, 'lo de la tarjeta 2 quedó guardado en la tarjeta 2');
  assert.equal(escena1.sucios.size, 0);
});

test('control: guardar siempre la escena inicial (el error anterior) pierde lo escrito en la tarjeta 2', async () => {
  const d = await guardarDocumento(crearDocumento({ titulo: 'Control del error', formato: 'tarjetas' }));
  const escenaInicial = new Escena([]);
  const escena2 = new Escena([]);
  const trazo = crearElemento(d.id, TIPOS_ELEMENTO.TEXTO, { contenedor: 't2', datos: { contenido: 'x' } });
  escena2.ejecutar([{ id: trazo.id, antes: null, despues: trazo }], 'crear');
  // Comportamiento anterior: la función de autoguardado quedaba atada a la escena inicial
  await guardarPendientesDeEscena(() => escenaInicial);
  assert.equal((await listarElementos(d.id)).length, 0, 'con la escena fija no se guarda nada de la tarjeta 2');
  // Con la escena vigente sí se guarda
  await guardarPendientesDeEscena(() => escena2);
  assert.equal((await listarElementos(d.id)).length, 1);
});

test('si el guardado falla, los pendientes vuelven a la escena de la que salieron', async () => {
  const escenaA = new Escena([]);
  const escenaB = new Escena([]);
  const el = crearElemento('doc-x', TIPOS_ELEMENTO.TEXTO, { contenedor: 't2', datos: { contenido: 'y' } });
  escenaB.ejecutar([{ id: el.id, antes: null, despues: el }], 'crear');
  const roto = { guardarElementos: async () => { throw new Error('disco lleno'); }, borrarElementos: async () => {} };
  await assert.rejects(() => guardarPendientesDeEscena(() => escenaB, roto), /disco lleno/);
  assert.ok(escenaB.sucios.has(el.id), 'el elemento sigue pendiente en su escena');
  assert.equal(escenaA.sucios.size, 0);
});

test('un fallo posterior (guardar el documento) también devuelve los pendientes', async () => {
  const escena = new Escena([]);
  const el = crearElemento('doc-y', TIPOS_ELEMENTO.TEXTO, { contenedor: 't1', datos: { contenido: 'z' } });
  escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'crear');
  const ok = { guardarElementos: async () => {}, borrarElementos: async () => {} };
  await assert.rejects(() => guardarPendientesDeEscena(() => escena, ok, async () => { throw new Error('falla el documento'); }));
  assert.ok(escena.sucios.has(el.id));
});

test('migración: lo que no pertenece a ninguna tarjeta pasa a la primera, sin tocar lo demás', async () => {
  const d = await guardarDocumento(crearDocumento({ titulo: 'Antiguo', formato: 'tarjetas' }));
  const huerfano = crearElemento(d.id, TIPOS_ELEMENTO.TEXTO, { contenedor: null, datos: { contenido: 'viejo' } });
  const huerfano2 = { ...crearElemento(d.id, TIPOS_ELEMENTO.TEXTO, { datos: { contenido: 'viejo 2' } }), contenedor: 'null' };
  const asignado = crearElemento(d.id, TIPOS_ELEMENTO.TEXTO, { contenedor: 't2', datos: { contenido: 'nuevo' } });
  const original = [huerfano, huerfano2, asignado];
  const r = asignarHuerfanos(original, 't1');
  assert.equal(r.cambiados.length, 2);
  assert.ok(r.elementos.every((e) => e.contenedor));
  assert.equal(r.elementos.find((e) => e.id === asignado.id), asignado, 'lo ya asignado no se toca');
  assert.equal(huerfano.contenedor, null, 'la lista original no se modifica');
  // Se guarda una sola vez y, al volver a cargar, ya no hay nada por migrar
  await guardarElementos(r.cambiados);
  const recargados = await listarElementos(d.id);
  assert.equal(asignarHuerfanos(recargados, 't1').cambiados.length, 0);
  // Ahora funcionan igual al abrir, al volver a la primera tarjeta y al duplicarla
  assert.equal(elementosDeTarjeta(r.elementos, 't1').length, 2);
  assert.equal(duplicarElementosTarjeta(r.elementos, 't1', 't3').length, 2);
});

test('historial de tarjetas: agregar se deshace y se rehace sobre la lista actual', () => {
  const lista = [{ id: 'a', titulo: 'A' }, { id: 'b', titulo: 'B' }];
  const nueva = { id: 'c', titulo: 'C' };
  const op = crearOperacion({ tipo: 'agregar', tarjeta: nueva, indice: 2, existeAntes: false, existeDespues: true, activaAntes: 'b', activaDespues: 'c' });
  const conNueva = [...lista, nueva];
  const deshecho = aplicarOperacion(conNueva, op, true);
  assert.deepEqual(deshecho.tarjetas.map((t) => t.id), ['a', 'b']);
  assert.equal(deshecho.activa, 'b');
  assert.ok(deshecho.quitar && !deshecho.restaurar);
  const rehecho = aplicarOperacion(deshecho.tarjetas, op, false);
  assert.deepEqual(rehecho.tarjetas.map((t) => t.id), ['a', 'b', 'c']);
  assert.equal(rehecho.activa, 'c');
  assert.ok(rehecho.restaurar);
});

test('historial de tarjetas: eliminar se deshace en su posición y respeta cambios posteriores', () => {
  const op = crearOperacion({ tipo: 'eliminar', tarjeta: { id: 'b', titulo: 'B' }, indice: 1, existeAntes: true, existeDespues: false, activaAntes: 'b', activaDespues: 'a', elementos: [{ id: 'e1' }] });
  // Después de eliminar B, se renombró A
  const actual = [{ id: 'a', titulo: 'A renombrada' }, { id: 'c', titulo: 'C' }];
  const r = aplicarOperacion(actual, op, true);
  assert.deepEqual(r.tarjetas.map((t) => t.id), ['a', 'b', 'c']);
  assert.equal(r.tarjetas[0].titulo, 'A renombrada', 'el cambio posterior no se revierte');
  assert.equal(r.activa, 'b');
  assert.ok(r.restaurar);
  assert.equal(op.elementos.length, 1);
});

test('historial de tarjetas: no deja el documento sin tarjetas y duplicar vuelve a la tarjeta de origen', () => {
  const unica = [{ id: 'a', titulo: 'A' }];
  const opAgregar = crearOperacion({ tipo: 'eliminar', tarjeta: { id: 'a', titulo: 'A' }, indice: 0, existeAntes: false, existeDespues: true, activaAntes: 'x', activaDespues: 'a' });
  assert.equal(aplicarOperacion(unica, opAgregar, true), null);
  const dup = crearOperacion({ tipo: 'duplicar', tarjeta: { id: 'a2', titulo: 'A (copia)' }, indice: 1, existeAntes: false, existeDespues: true, activaAntes: 'a', activaDespues: 'a2' });
  const r = aplicarOperacion([{ id: 'a', titulo: 'A' }, { id: 'a2', titulo: 'A (copia)' }], dup, true);
  assert.equal(r.activa, 'a');
});

test('historial de tarjetas: pila de deshacer y rehacer; una operación nueva descarta lo rehacible', () => {
  const h = crearHistorialTarjetas();
  const mk = (id) => crearOperacion({ tipo: 'agregar', tarjeta: { id, titulo: id }, indice: 0, existeAntes: false, existeDespues: true, activaAntes: 'a', activaDespues: id });
  assert.ok(!h.puedeDeshacer() && !h.puedeRehacer());
  h.registrar(mk('b')); h.registrar(mk('c'));
  assert.equal(h.tomarDeshacer().tarjeta.id, 'c');
  assert.ok(h.puedeRehacer());
  h.limpiarFuturo();
  assert.ok(!h.puedeRehacer());
  assert.equal(h.tomarDeshacer().tarjeta.id, 'b');
  assert.equal(h.tomarDeshacer(), null);
  h.registrar(mk('d'));
  h.tomarDeshacer();
  h.registrar(mk('e'));
  assert.ok(!h.puedeRehacer(), 'registrar una operación nueva borra lo rehacible');
});

test('la escena avisa al registrar una acción (para descartar las operaciones de tarjetas rehacibles)', () => {
  const escena = new Escena([]);
  let avisos = 0;
  escena.historial.alRegistrar = () => { avisos++; };
  const el = crearElemento('d', TIPOS_ELEMENTO.TEXTO, { contenedor: 't1', datos: { contenido: 'a' } });
  escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'crear');
  assert.equal(avisos, 1);
  escena.deshacer(); escena.rehacer();
  assert.equal(avisos, 1, 'deshacer y rehacer de la escena no cuentan como acciones nuevas');
});

test('el motor usa el historial de tarjetas solo cuando la tarjeta activa no tiene nada que deshacer', async () => {
  const escena = new Escena([]);
  const motor = new Lienzo(canvas, { escena, documentoId: 'd', contenedor: 't1', ajustes: null });
  const llamadas = [];
  motor.historialExtra = { puedeDeshacer: () => true, puedeRehacer: () => true, deshacer: () => llamadas.push('d'), rehacer: () => llamadas.push('r') };
  assert.equal(motor._notificar !== undefined, true);
  motor.deshacer(); motor.rehacer();
  assert.deepEqual(llamadas, ['d', 'r'], 'sin acciones propias se usa el historial de tarjetas');
  const el = crearElemento('d', TIPOS_ELEMENTO.TEXTO, { contenedor: 't1', datos: { contenido: 'a' } });
  escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'crear');
  motor.deshacer();
  assert.deepEqual(llamadas, ['d', 'r'], 'con acciones propias se deshace primero la de la tarjeta');
  assert.equal(escena.mapa.size, 0);
  motor.destruir();
});

// ---------------------------------------------------------------------------------------------
// Modo estudio: lógica de navegación
// ---------------------------------------------------------------------------------------------
test('modo estudio: avanzar y retroceder se detiene en la primera y en la última tarjeta', () => {
  assert.equal(moverEstudio(0, -1, 5), 0);
  assert.equal(moverEstudio(4, 1, 5), 4);
  assert.equal(moverEstudio(2, 1, 5), 3);
  assert.equal(moverEstudio(2, -1, 5), 1);
  assert.equal(moverEstudio(0, 1, 1), 0);
  assert.equal(moverEstudio(3, 1, 0), 0);
});

test('modo estudio: teclas de navegación', () => {
  assert.equal(pasoPorTecla('ArrowRight', 1, 4), 2);
  assert.equal(pasoPorTecla('ArrowLeft', 1, 4), 0);
  assert.equal(pasoPorTecla('ArrowLeft', 0, 4), 0);
  assert.equal(pasoPorTecla('ArrowRight', 3, 4), 3);
  assert.equal(pasoPorTecla('Home', 2, 4), 0);
  assert.equal(pasoPorTecla('End', 0, 4), 3);
  assert.equal(pasoPorTecla('a', 0, 4), null);
});

test('modo estudio: toques por zona y deslizamientos', () => {
  assert.equal(pasoPorToque(50, 900), -1);
  assert.equal(pasoPorToque(450, 900), 0);
  assert.equal(pasoPorToque(850, 900), 1);
  assert.equal(pasoPorToque(10, 0), 0);
  assert.equal(pasoPorDeslizamiento(-120, 10), 1, 'deslizar a la izquierda avanza');
  assert.equal(pasoPorDeslizamiento(120, 10), -1, 'deslizar a la derecha retrocede');
  assert.equal(pasoPorDeslizamiento(20, 0), 0, 'movimiento corto: no cuenta');
  assert.equal(pasoPorDeslizamiento(80, 120), 0, 'más vertical que horizontal: no cuenta');
});
