// Renglones (Etapa 8): configuración, dibujo, aparición breve, alineado y que nunca muevan nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="c"><canvas id="cv" tabindex="0"></canvas></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.HTMLCanvasElement.prototype.getContext = () => null;

const R = await import('../src/lienzo/renglones.js');
const { Escena } = await import('../src/lienzo/escena.js');
const { Lienzo } = await import('../src/lienzo/motor.js');
const { crearDocumento } = await import('../src/almacen/modelo.js');

const cfg = (extra = {}) => R.normalizarRenglones({ estilo: 'rayado', interlineado: 32, ...extra });

test('la configuración se completa y se acota, incluso con documentos de versiones anteriores', () => {
  const d = R.normalizarRenglones(undefined);
  assert.deepEqual([d.estilo, d.activos, d.modo, d.duracion, d.interlineado, d.alinear], ['rayado', true, 'siempre', 2, 32, false]);
  const viejo = R.normalizarRenglones({ estilo: 'puntos', modo: 'breve', interlineado: 32, intensidad: 0.35, alinear: false }); // sin color ni «activos»
  assert.equal(viejo.color, '#2350d8'); assert.equal(viejo.activos, true);
  const raro = R.normalizarRenglones({ estilo: 'dorado', modo: 'x', interlineado: 9999, intensidad: 50, color: 'rojo', duracion: 7 });
  assert.deepEqual([raro.estilo, raro.modo, raro.interlineado, raro.intensidad, raro.color, raro.duracion], ['rayado', 'siempre', 160, 1, '#2350d8', 2]);
  assert.equal(R.normalizarRenglones({ interlineado: 1 }).interlineado, 12);
  assert.equal(crearDocumento({ estiloRenglones: 'puntos' }).renglones.estilo, 'puntos');
});

test('aparición breve: fundido de entrada, se mantiene el tiempo elegido y se desvanece', () => {
  const c = cfg({ modo: 'breve', duracion: 2 }), d = { inicio: 1000, duracion: 2 };
  const op = (ms) => +R.opacidadRenglones(c, 1000 + ms, d).toFixed(3);
  assert.deepEqual([op(0), op(100), op(200), op(1000), op(1999)], [0, 0.5, 1, 1, 1]);
  assert.deepEqual([op(2250), op(2500)], [0.5, 0]);
  assert.equal(R.destelloVigente(d, 1000 + 2400), true);
  assert.equal(R.destelloVigente(d, 1000 + 2600), false);
  assert.equal(R.opacidadRenglones(c, 1000, null), 0); // sin aparición en curso, ocultos
  assert.equal(R.opacidadRenglones(cfg({ modo: 'ocultos' }), 1500, d), 1); // «Mostrar ahora»
  assert.equal(R.opacidadRenglones(cfg({ modo: 'siempre' }), 5, null), 1);
  assert.equal(R.opacidadRenglones(cfg({ activos: false }), 5, null), 0);
  assert.equal(R.opacidadRenglones(cfg({ estilo: 'liso' }), 5, null), 0);
});

function contador() {
  const n = { moveTo: 0, rect: 0, stroke: 0, fill: 0, estilos: [] };
  const ctx = new Proxy({}, { get: (t, k) => (k === 'moveTo' ? () => n.moveTo++ : k === 'rect' ? () => n.rect++ : k === 'stroke' ? () => n.stroke++ : k === 'fill' ? () => n.fill++ : () => {}), set: (t, k, v) => { if (k === 'strokeStyle' || k === 'fillStyle') n.estilos.push(v); return true; } });
  return { n, ctx };
}
const vista = { x: 0, y: 0, zoom: 1 };

test('el dibujo traza solo lo que se ve: rayado, cuadriculado y puntos', () => {
  let { n, ctx } = contador(); R.dibujarRenglones(ctx, cfg(), vista, 800, 600, 1);
  assert.equal(n.moveTo, 20); // 600/32 → 19 renglones + 1 de borde
  ({ n, ctx } = contador()); R.dibujarRenglones(ctx, cfg({ estilo: 'cuadriculado' }), vista, 800, 600, 1);
  assert.equal(n.moveTo, 20 + 26);
  ({ n, ctx } = contador()); R.dibujarRenglones(ctx, cfg({ estilo: 'puntos' }), vista, 800, 600, 1);
  assert.equal(n.rect, 26 * 20); assert.equal(n.fill, 1); // todos los puntos en una sola orden
  for (const e of [{ estilo: 'liso' }]) { ({ n, ctx } = contador()); R.dibujarRenglones(ctx, cfg(e), vista, 800, 600, 1); assert.equal(n.moveTo + n.rect, 0); }
  ({ n, ctx } = contador()); R.dibujarRenglones(ctx, cfg(), vista, 800, 600, 0); assert.equal(n.moveTo, 0); // invisibles
});

test('al alejar la vista los renglones se desvanecen en lugar de formar una mancha', () => {
  const alfa = (z) => { const { n, ctx } = contador(); R.dibujarRenglones(ctx, cfg({ intensidad: 1 }), { x: 0, y: 0, zoom: z }, 800, 600, 1); return n.estilos[0] ? +/,([\d.]+)\)$/.exec(n.estilos[0])[1] : 0; };
  assert.ok(alfa(1) > alfa(0.22) && alfa(0.22) > 0);
  assert.equal(alfa(0.1), 0); // 3,2 px entre renglones: no se dibujan
});

test('alinear: rayado solo en vertical; cuadriculado y puntos en ambos ejes; sin guía no cambia nada', () => {
  const p = { x: 50, y: 70 };
  assert.deepEqual(R.alinearPunto(cfg({ alinear: true }), p), { x: 50, y: 64 });
  assert.deepEqual(R.alinearPunto(cfg({ alinear: true, estilo: 'cuadriculado' }), p), { x: 64, y: 64 });
  assert.deepEqual(R.alinearPunto(cfg({ alinear: true, estilo: 'puntos', interlineado: 20 }), p), { x: 60, y: 80 });
  for (const e of [{ alinear: false }, { alinear: true, estilo: 'liso' }, { alinear: true, activos: false }]) assert.deepEqual(R.alinearPunto(cfg(e), p), p);
});

// ---------- motor ----------
const canvas = document.getElementById('cv');
const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
canvas.getBoundingClientRect = () => rect; canvas.parentElement.getBoundingClientRect = () => rect;
canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {};
const falso = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
canvas.getContext = falso;
let escena, motor, guardados;
const nuevo = (renglones, extra = {}) => { motor?.destruir(); escena = new Escena(); guardados = []; motor = new Lienzo(canvas, { escena, documentoId: 'd', camara: { x: 0, y: 0, zoom: 1 }, renglones, alRenglones: (r) => guardados.push(r), ...extra }); };
function ptr(tipo, x, y, shift = false) {
  const e = new dom.window.MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, shiftKey: shift });
  Object.defineProperty(e, 'pointerId', { value: 1 }); Object.defineProperty(e, 'pointerType', { value: 'mouse' }); canvas.dispatchEvent(e);
}
const arrastrar = (x1, y1, x2, y2) => { ptr('pointerdown', x1, y1); ptr('pointermove', (x1 + x2) / 2, (y1 + y2) / 2); ptr('pointermove', x2, y2); ptr('pointerup', x2, y2); };
const instantanea = () => JSON.stringify(escena.lista());

test('encender, apagar y cambiar renglones no mueve ni modifica nada de lo escrito', () => {
  nuevo({ estilo: 'rayado' });
  motor.setHerramienta('rectangulo'); arrastrar(100, 100, 220, 180);
  motor.setHerramienta('flecha'); arrastrar(300, 300, 500, 380);
  motor.setHerramienta('lapiz'); arrastrar(150, 400, 400, 450);
  motor.generarTrazos(300);
  const antes = instantanea(), version = escena.version, historia = escena.historial.pasado.length;
  escena.tomarPendientes();
  for (const parche of [{ activos: false }, { activos: true }, { estilo: 'cuadriculado' }, { estilo: 'puntos' }, { estilo: 'liso' }, { estilo: 'rayado', interlineado: 70 }, { modo: 'breve', duracion: 1 }, { modo: 'ocultos' }, { alinear: true }, { color: '#d6336c', intensidad: 0.9 }, { modo: 'siempre', alinear: false }]) {
    motor.configurarRenglones(parche, { previa: true });
  }
  motor.alternarRenglones(); motor.alternarRenglones(); motor.mostrarRenglones();
  assert.equal(instantanea(), antes); // ni un solo dato cambió
  assert.equal(escena.version, version);
  assert.equal(escena.historial.pasado.length, historia);
  assert.equal(escena.tomarPendientes().guardar.length, 0); // y no hay nada nuevo que guardar
  assert.ok(guardados.length >= 11); // la configuración sí se avisa para guardarla en el documento
  assert.equal(guardados.at(-1).modo, 'siempre');
});

test('en modo breve los renglones aparecen al activarlos y luego desaparecen', () => {
  nuevo({ estilo: 'rayado', modo: 'breve', duracion: 1, activos: false });
  const op = () => motor._fondoRenglones().opacidad;
  assert.equal(op(), 0);
  motor.alternarRenglones(); // se activan: aparecen un momento
  assert.ok(motor._destello && motor._destello.duracion === 1);
  motor._destello.inicio = motor._ahora() - 500; assert.equal(op(), 1);
  motor._destello.inicio = motor._ahora() - 5000; assert.equal(op(), 0);
  nuevo({ estilo: 'rayado', modo: 'ocultos' });
  motor.mostrarRenglones(); assert.ok(motor._destello); assert.equal(motor._destello.duracion, 1.5);
  nuevo({ estilo: 'rayado', modo: 'siempre' });
  motor.configurarRenglones({ interlineado: 50 }, { previa: true }); assert.equal(motor._destello, null);
});

const figuras = () => escena.lista().filter((e) => e.tipo === 'figura');
test('alinear al renglón: las figuras nuevas caen sobre la guía; sin activarlo, no', () => {
  nuevo({ estilo: 'cuadriculado', interlineado: 40, alinear: true });
  motor.setHerramienta('rectangulo'); arrastrar(103, 97, 222, 181);
  let [f] = figuras();
  assert.deepEqual([f.x, f.y, f.x + f.ancho, f.y + f.alto], [120, 80, 240, 200]);
  assert.ok([f.x, f.y, f.ancho, f.alto].every((v) => v % 40 === 0));
  nuevo({ estilo: 'rayado', interlineado: 40, alinear: true });
  motor.setHerramienta('linea'); arrastrar(103, 97, 222, 181);
  [f] = figuras();
  assert.equal(f.y % 40, 0); assert.equal((f.y + f.alto) % 40, 0); assert.ok(f.x === 103 && f.x + f.ancho === 222); // en rayado solo cuenta la altura
  nuevo({ estilo: 'cuadriculado', interlineado: 40, alinear: false });
  motor.setHerramienta('rectangulo'); arrastrar(103, 97, 222, 181);
  assert.equal(figuras()[0].x, 103);
  nuevo({ estilo: 'liso', interlineado: 40, alinear: true });
  motor.setHerramienta('rectangulo'); arrastrar(103, 97, 222, 181);
  assert.equal(figuras()[0].x, 103);
});

test('alinear al renglón: el texto nuevo apoya su primer renglón sobre un renglón del fondo', async () => {
  const { baseDelPrimerRenglon } = await import('../src/herramientas/texto/pintar.js');
  nuevo({ estilo: 'rayado', interlineado: 40, alinear: true });
  motor.setHerramienta('texto');
  ptr('pointerdown', 210, 133); ptr('pointerup', 210, 133);
  const el = motor.texto.base;
  const base = baseDelPrimerRenglon(el.datos, el.ancho);
  assert.ok(Math.abs((el.y + base) % 40) < 1e-6 || Math.abs((el.y + base) % 40 - 40) < 1e-6);
  motor.cerrarTexto();
});

test('alinear al renglón: al mover o ensanchar se acomoda a la guía y los trazos a mano no se tocan', () => {
  nuevo({ estilo: 'cuadriculado', interlineado: 40, alinear: false });
  motor.setHerramienta('rectangulo'); arrastrar(101, 99, 221, 179);
  motor.setHerramienta('lapiz'); arrastrar(400, 300, 500, 330);
  const r0 = figuras()[0], t0 = escena.lista().find((e) => e.tipo === 'trazo');
  motor.configurarRenglones({ alinear: true });
  motor.setHerramienta('seleccionar'); motor.seleccion = new Set([r0.id, t0.id]);
  arrastrar(150, 130, 237, 163); // se corre (+87, +33)
  const r1 = escena.get(r0.id), t1 = escena.get(t0.id);
  assert.ok(r1.x % 40 === 0 && r1.y % 40 === 0);
  assert.equal(t1.x - t0.x, r1.x - r0.x); assert.equal(t1.y - t0.y, r1.y - r0.y); // el trazo viaja con la selección sin deformarse
  motor.seleccion = new Set([r1.id]);
  arrastrar(r1.x + r1.ancho, r1.y + r1.alto, r1.x + r1.ancho + 53, r1.y + r1.alto + 27); // asa sudeste
  const r2 = escena.get(r0.id);
  assert.ok((r2.x + r2.ancho) % 40 === 0 && (r2.y + r2.alto) % 40 === 0);
});

test('Alt+G enciende y apaga los renglones, y el atajo no actúa desde un campo', () => {
  nuevo({ estilo: 'rayado' });
  const tecla = (k, objetivo = window, altKey = false) => objetivo.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, altKey, bubbles: true, cancelable: true }));
  tecla('g', window, true); assert.equal(motor.renglones.activos, false);
  tecla('g', window, true); assert.equal(motor.renglones.activos, true);
  const campo = document.createElement('input'); document.body.appendChild(campo);
  campo.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'g', altKey: true, bubbles: true, cancelable: true }));
  assert.equal(motor.renglones.activos, true);
  campo.remove();
});
