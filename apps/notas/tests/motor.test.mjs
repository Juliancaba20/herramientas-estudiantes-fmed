// Prueba de integración del motor con un DOM simulado (jsdom) y un lienzo 2D de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

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
canvas.getContext = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });

const escena = new Escena();
let camaraGuardada = null;
const motor = new Lienzo(canvas, { escena, documentoId: 'doc', alCamara: (c) => { camaraGuardada = c; } });
const tick = () => new Promise((r) => setTimeout(r, 15));
function ptr(tipo, x, y, { id = 1, pointerType = 'mouse', button = 0, shiftKey = false } = {}) {
  const e = new dom.window.MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button, shiftKey });
  Object.defineProperty(e, 'pointerId', { value: id }); Object.defineProperty(e, 'pointerType', { value: pointerType });
  canvas.dispatchEvent(e);
}
const arrastrar = (a, b, o) => { ptr('pointerdown', a[0], a[1], o); ptr('pointermove', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, o); ptr('pointermove', b[0], b[1], o); ptr('pointerup', b[0], b[1], o); };
const tecla = (key, o = {}) => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, ...o }));
const unico = () => escena.lista()[0];

test('crear una figura arrastrando con la herramienta rectángulo', () => {
  motor.setHerramienta('rectangulo');
  arrastrar([100, 100], [200, 180]);
  assert.equal(escena.mapa.size, 1);
  assert.deepEqual([unico().x, unico().y, unico().ancho, unico().alto], [60, 60, 100, 80]); // cámara inicial: -40, -40
  assert.equal(motor.seleccion.size, 1);
  assert.equal(motor.herramienta, 'seleccionar');
  assert.ok(escena.historial.puedeDeshacer());
});

test('un clic sin arrastrar no crea figuras vacías', () => {
  motor.setHerramienta('elipse');
  ptr('pointerdown', 300, 300); ptr('pointerup', 300, 300);
  assert.equal(escena.mapa.size, 1);
  motor.setHerramienta('seleccionar');
});

test('mover con el mouse, deshacer y rehacer', () => {
  arrastrar([150, 140], [250, 190]);
  assert.deepEqual([unico().x, unico().y], [160, 110]);
  tecla('z', { ctrlKey: true });
  assert.deepEqual([unico().x, unico().y], [60, 60]);
  tecla('y', { ctrlKey: true });
  assert.deepEqual([unico().x, unico().y], [160, 110]);
  tecla('z', { ctrlKey: true, shiftKey: true }); // otra forma de deshacer es Ctrl+Z; con Shift rehace: no hay nada más
  assert.deepEqual([unico().x, unico().y], [160, 110]);
});

test('redimensionar desde la manija inferior derecha', () => {
  const el = unico();
  const sx = el.x + el.ancho + 40, sy = el.y + el.alto + 40; // a pantalla
  arrastrar([sx, sy], [sx + 60, sy + 30]);
  assert.deepEqual([unico().ancho, unico().alto], [160, 110]);
  motor.deshacer();
  assert.deepEqual([unico().ancho, unico().alto], [100, 80]);
});

test('zoom con la rueda deja fijo el punto bajo el cursor', () => {
  const antes = { x: 400, y: 300 };
  const mundoAntes = { x: motor.camara.x + antes.x / motor.camara.zoom, y: motor.camara.y + antes.y / motor.camara.zoom };
  canvas.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -100, clientX: 400, clientY: 300, cancelable: true }));
  assert.ok(motor.camara.zoom > 1);
  const mundoDespues = { x: motor.camara.x + 400 / motor.camara.zoom, y: motor.camara.y + 300 / motor.camara.zoom };
  assert.ok(Math.abs(mundoAntes.x - mundoDespues.x) < 1e-9 && Math.abs(mundoAntes.y - mundoDespues.y) < 1e-9);
  assert.ok(camaraGuardada);
  motor.zoomReal();
  assert.equal(motor.camara.zoom, 1);
});

test('pellizco de dos dedos: acerca y no toca los elementos', () => {
  const antes = unico();
  const t = { pointerType: 'touch' };
  ptr('pointerdown', 380, 300, { id: 1, ...t }); ptr('pointerdown', 420, 300, { id: 2, ...t });
  ptr('pointermove', 340, 300, { id: 1, ...t }); ptr('pointermove', 460, 300, { id: 2, ...t });
  ptr('pointerup', 340, 300, { id: 1, ...t }); ptr('pointerup', 460, 300, { id: 2, ...t });
  assert.ok(motor.camara.zoom > 2.5);
  assert.deepEqual([unico().x, unico().y], [antes.x, antes.y]);
  motor.zoomReal();
});

test('herramienta mano y barra espaciadora mueven el lienzo; la figura queda quieta', () => {
  const c0 = { ...motor.camara }, f0 = unico().x;
  motor.setHerramienta('mano'); arrastrar([100, 100], [160, 130]);
  assert.ok(motor.camara.x < c0.x); assert.equal(unico().x, f0);
  motor.setHerramienta('seleccionar');
  window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
  arrastrar([100, 100], [140, 100]);
  window.dispatchEvent(new dom.window.KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
  assert.equal(unico().x, f0);
});

test('selección por marco, por Shift y eliminación con Supr y deshacer', () => {
  motor.camara = { x: -40, y: -40, zoom: 1 };
  motor.setHerramienta('rectangulo'); arrastrar([400, 400], [450, 450]); // segunda figura
  assert.equal(escena.mapa.size, 2);
  motor.seleccion = new Set();
  arrastrar([10, 10], [700, 550]); // marco que las cubre
  assert.equal(motor.seleccion.size, 2);
  tecla('Delete');
  assert.equal(escena.mapa.size, 0);
  tecla('z', { ctrlKey: true });
  assert.equal(escena.mapa.size, 2);
});

test('rendimiento: 5000 figuras y solo se dibujan las visibles', async () => {
  motor.borrarTodo();
  const t0 = performance.now();
  motor.generarFiguras(5000);
  await tick();
  assert.equal(escena.mapa.size, 5000);
  motor.zoomPaso(8); // mucho acercamiento
  await tick();
  assert.ok(motor.dibujados < 500, `se dibujaron ${motor.dibujados}`);
  const t = performance.now() - t0;
  assert.ok(t < 3000, `tardó ${Math.round(t)} ms`);
  const p = escena.tomarPendientes();
  assert.ok(p.guardar.length >= 5000);
});

test.after(() => { motor.destruir(); dom.window.close(); });
