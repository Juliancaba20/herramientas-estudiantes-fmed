// Pizarrón completo (Etapa 7): formas básicas, estilo de figuras, minimapa, «volver al contenido» y dibujo liviano.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="c"><canvas id="cv" tabindex="0"></canvas></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.HTMLCanvasElement.prototype.getContext = () => null;

const G = await import('../src/lienzo/geometria.js');
const { geometriaMinimapa } = await import('../src/lienzo/minimapa.js');
const { Escena } = await import('../src/lienzo/escena.js');
const { Lienzo } = await import('../src/lienzo/motor.js');
const { dibujar, dibujarTrazo } = await import('../src/lienzo/dibujo.js');
const { crearElemento } = await import('../src/almacen/modelo.js');

const linea = (x, y, w, h, extra = {}) => ({ id: 'l', tipo: 'figura', x, y, ancho: w, alto: h, datos: { forma: 'linea', grosor: 2, borde: '#000', ...extra } });

test('líneas: extremos, dirección y hit-test a lo largo del segmento', () => {
  const l = linea(0, 0, 100, 100); // de arriba-izquierda a abajo-derecha
  assert.deepEqual(G.extremosLinea(l), [{ x: 0, y: 0 }, { x: 100, y: 100 }]);
  const v = linea(0, 0, 100, 100, { volteoX: true }); // de arriba-derecha a abajo-izquierda
  assert.deepEqual(G.extremosLinea(v), [{ x: 100, y: 0 }, { x: 0, y: 100 }]);
  assert.ok(G.puntoEnElemento(l, 50, 50, 2));
  assert.ok(!G.puntoEnElemento(l, 90, 10, 2)); // dentro de la caja pero lejos de la línea
  assert.ok(G.puntoEnElemento(v, 90, 10, 2));
  assert.deepEqual(G.manijas(l).map((m) => m.n), ['p1', 'p2']);
});

test('mover un extremo reorienta la línea, incluso al pasar al otro lado', () => {
  const l = linea(10, 10, 100, 0);
  const m = G.moverExtremo(l, 'p2', -150, 40); // el final cruza hacia la izquierda y abajo
  assert.deepEqual(G.extremosLinea(m), [{ x: 10, y: 10 }, { x: -40, y: 50 }]);
  assert.deepEqual([m.x, m.y, m.ancho, m.alto, m.datos.volteoX, m.datos.volteoY], [-40, 10, 50, 40, true, false]);
  const n = G.moverExtremo(m, 'p1', 0, 100);
  assert.deepEqual(G.extremosLinea(n)[0], { x: 10, y: 110 });
});

test('triángulo y rombo: solo se toca dentro de la figura', () => {
  const t = { id: 't', tipo: 'figura', x: 0, y: 0, ancho: 100, alto: 100, datos: { forma: 'triangulo' } };
  assert.ok(G.puntoEnElemento(t, 50, 60));
  assert.ok(!G.puntoEnElemento(t, 5, 5)); // esquina vacía de la caja
  const r = { ...t, datos: { forma: 'rombo' } };
  assert.ok(G.puntoEnElemento(r, 50, 50));
  assert.ok(!G.puntoEnElemento(r, 5, 5));
  assert.ok(G.puntoEnElemento(r, 4, 50, 0)); // la punta izquierda
});

test('minimapa: el contenido y la vista caben, y el mapeo es reversible', () => {
  const contenido = { x: 0, y: 0, ancho: 4000, alto: 2000 };
  const vista = { x: 5000, y: 100, ancho: 800, alto: 600 }; // fuera del contenido
  const g = geometriaMinimapa(contenido, vista, 168, 112);
  for (const [x, y] of [[0, 0], [4000, 2000], [5000, 100], [5800, 700]]) {
    const p = g.aMini(x, y);
    assert.ok(p.x >= 0 && p.x <= 168 && p.y >= 0 && p.y <= 112, `(${x},${y}) → ${p.x},${p.y}`);
    const q = g.aMundo(p.x, p.y);
    assert.ok(Math.abs(q.x - x) < 1e-6 && Math.abs(q.y - y) < 1e-6);
  }
  const solo = geometriaMinimapa(null, vista, 168, 112); // pizarrón vacío: solo la vista
  assert.ok(solo.escala > 0);
});

test('la escena guarda en caché los límites y los recalcula al cambiar', () => {
  const e = new Escena();
  assert.equal(e.limites(), null);
  const a = crearElemento('d', 'figura', { x: 0, y: 0, ancho: 10, alto: 10, datos: { forma: 'rectangulo' } });
  e.ejecutar([{ id: a.id, antes: null, despues: a }]);
  const l1 = e.limites();
  assert.equal(e.limites(), l1); // misma caja, sin recalcular
  const b = crearElemento('d', 'figura', { x: 100, y: 50, ancho: 10, alto: 10, datos: { forma: 'rectangulo' } });
  e.ejecutar([{ id: b.id, antes: null, despues: b }]);
  assert.deepEqual(e.limites(), { x: 0, y: 0, ancho: 110, alto: 60 });
  e.deshacer();
  assert.deepEqual(e.limites(), l1);
});

// ---------- motor ----------
const canvas = document.getElementById('cv');
const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
canvas.getBoundingClientRect = () => rect;
canvas.parentElement.getBoundingClientRect = () => rect;
canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {};
const falso = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
canvas.getContext = falso;
let escena, motor;
const nuevo = (op = {}) => { motor?.destruir(); escena = new Escena(); motor = new Lienzo(canvas, { escena, documentoId: 'doc', camara: { x: 0, y: 0, zoom: 1 }, ...op }); };
function ptr(tipo, x, y, extra = {}) {
  const e = new dom.window.MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, shiftKey: !!extra.shift });
  Object.defineProperty(e, 'pointerId', { value: 1 }); Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  canvas.dispatchEvent(e);
}
const arrastrar = (x1, y1, x2, y2, extra) => { ptr('pointerdown', x1, y1); ptr('pointermove', (x1 + x2) / 2, (y1 + y2) / 2, extra); ptr('pointermove', x2, y2, extra); ptr('pointerup', x2, y2, extra); };
const figuras = () => escena.lista().filter((e) => e.tipo === 'figura');

test('cada forma se crea arrastrando y queda seleccionada con la herramienta Seleccionar', () => {
  nuevo();
  for (const f of G.FORMAS) {
    motor.setHerramienta(f);
    arrastrar(100, 100, 220, 180);
    assert.equal(motor.herramienta, 'seleccionar', f);
  }
  assert.deepEqual(figuras().map((e) => e.datos.forma), G.FORMAS);
  assert.equal(motor.ajustes.figura.borde, '#2350d8');
  assert.equal(figuras()[0].datos.relleno, null);
});

test('una flecha dibujada hacia arriba y a la izquierda conserva su dirección; Mayús la lleva a 45°', () => {
  nuevo(); motor.setHerramienta('flecha');
  arrastrar(300, 300, 200, 250);
  let [f] = figuras();
  assert.deepEqual([f.datos.volteoX, f.datos.volteoY], [true, true]);
  assert.deepEqual(G.extremosLinea(f)[1], { x: 200, y: 250 });
  nuevo(); motor.setHerramienta('linea');
  arrastrar(100, 100, 260, 130, { shift: true }); // casi horizontal → exactamente horizontal
  [f] = figuras();
  assert.ok(f.alto < 1e-6 && f.ancho > 150);
});

test('Mayús en un rectángulo da un cuadrado; un clic sin arrastrar no crea nada', () => {
  nuevo(); motor.setHerramienta('rectangulo');
  arrastrar(100, 100, 220, 150, { shift: true });
  assert.equal(figuras()[0].ancho, figuras()[0].alto);
  nuevo(); motor.setHerramienta('elipse');
  ptr('pointerdown', 50, 50); ptr('pointerup', 50, 50);
  assert.equal(figuras().length, 0);
});

test('el estilo de las figuras cambia las seleccionadas, se puede deshacer y vale para las nuevas', () => {
  nuevo(); motor.setHerramienta('rectangulo'); arrastrar(100, 100, 200, 160);
  const id = figuras()[0].id;
  motor.estiloFiguras({ borde: '#d6336c', relleno: '#ffe9a8', grosor: 8 });
  const f = escena.get(id);
  assert.deepEqual([f.datos.borde, f.datos.relleno, f.datos.grosor], ['#d6336c', '#ffe9a8', 8]);
  assert.equal(motor._estiloFigura().borde, '#d6336c');
  motor.deshacer();
  assert.equal(escena.get(id).datos.borde, '#2350d8');
  motor.setHerramienta('elipse'); arrastrar(300, 300, 380, 340);
  const e = figuras().find((x) => x.datos.forma === 'elipse');
  assert.deepEqual([e.datos.borde, e.datos.relleno], ['#d6336c', '#ffe9a8']);
  motor.estiloFiguras({ relleno: null });
  assert.equal(escena.get(e.id).datos.relleno, null);
});

test('el grosor de una figura es el mismo en el mundo con cualquier zoom', () => {
  nuevo({ camara: { x: 0, y: 0, zoom: 2 } }); motor.setHerramienta('rectangulo'); arrastrar(100, 100, 300, 200);
  assert.equal(figuras()[0].datos.grosor, 3); // igual que a 100 %
  assert.equal(motor._estiloFigura().grosor, 3);
});

test('arrastrar un extremo de la línea la reorienta y se puede deshacer', () => {
  nuevo(); motor.setHerramienta('linea'); arrastrar(100, 100, 300, 100);
  const l = figuras()[0];
  motor.seleccion = new Set([l.id]);
  arrastrar(300, 100, 250, 200); // manija del final
  const n = escena.get(l.id);
  assert.deepEqual(G.extremosLinea(n), [{ x: 100, y: 100 }, { x: 250, y: 200 }]);
  motor.deshacer();
  assert.deepEqual(G.extremosLinea(escena.get(l.id)), [{ x: 100, y: 100 }, { x: 300, y: 100 }]);
});

test('«volver al contenido» aparece solo cuando no queda nada a la vista', () => {
  nuevo();
  assert.equal(motor._hayContenidoVisible(), true); // pizarrón vacío
  motor.setHerramienta('rectangulo'); arrastrar(100, 100, 200, 160);
  assert.equal(motor._hayContenidoVisible(), true);
  motor.irA(5000, 5000);
  assert.equal(motor._hayContenidoVisible(), false);
  motor.encuadrarTodo();
  assert.equal(motor._hayContenidoVisible(), true);
  motor.irA(150, 130);
  assert.ok(Math.abs(motor.camara.x - (150 - 400 / motor.camara.zoom)) < 1e-9); // centrado en el punto, sin cambiar el zoom
});

test('generarTrazos crea trazos válidos que el motor puede encuadrar y borrar', () => {
  nuevo(); motor.generarTrazos(200);
  assert.equal(escena.mapa.size, 200);
  assert.ok(escena.lista().every((e) => e.tipo === 'trazo' && e.datos.puntos.length >= 25 && e.ancho > 0));
  motor.borrarTodo();
  assert.equal(escena.mapa.size, 0);
});

// ---------- dibujo liviano ----------
function contador() {
  const n = { lineTo: 0, quad: 0, stroke: 0, arc: 0 };
  const ctx = new Proxy({}, { get: (t, k) => (k === 'lineTo' ? () => n.lineTo++ : k === 'quadraticCurveTo' ? () => n.quad++ : k === 'stroke' ? () => n.stroke++ : () => {}), set: () => true });
  return { n, ctx };
}
test('con la vista alejada los trazos se simplifican y los diminutos no se dibujan', () => {
  const pts = Array.from({ length: 80 }, (_, i) => [i * 3, Math.sin(i / 4) * 10, 0.5]);
  const d = { puntos: pts, color: '#000', grosor: 3, opacidad: 1, variable: true };
  const cerca = contador(); dibujarTrazo(cerca.ctx, d, 1);
  const lejos = contador(); dibujarTrazo(lejos.ctx, d, 0.1);
  assert.ok(cerca.n.stroke > 50); // con zoom normal y presión: un tramo por segmento
  assert.equal(lejos.n.stroke, 1); // alejado: un solo recorrido
  assert.ok(lejos.n.lineTo < 25 && lejos.n.quad === 0);

  const escenaLejos = new Escena();
  const grande = crearElemento('d', 'trazo', { x: 0, y: 0, ancho: 200, alto: 100, datos: d });
  const chico = crearElemento('d', 'trazo', { x: 50, y: 50, ancho: 1, alto: 1, datos: { ...d, puntos: [[50, 50, 0.5], [51, 51, 0.5]] } });
  escenaLejos.ejecutar([{ id: grande.id, antes: null, despues: grande }, { id: chico.id, antes: null, despues: chico }]);
  const c = contador();
  const res = dibujar(c.ctx, { camara: { x: 0, y: 0, zoom: 0.1 }, ancho: 800, alto: 600, dpr: 1, lista: escenaLejos.lista(), escena: escenaLejos, seleccion: new Set() });
  assert.equal(res.dibujados, 1); // el de 1 unidad a 10 % ocupa 0,1 px
});
