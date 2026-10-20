// Escritura a mano: lápiz, resaltador, borrador, presión y rechazo de palma (con DOM simulado).
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
const falso = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
canvas.getContext = falso;
dom.window.HTMLCanvasElement.prototype.getContext = falso;

let ultimosAjustes = null;
let escena, motor;
function nuevo() {
  motor?.destruir();
  escena = new Escena();
  motor = new Lienzo(canvas, { escena, documentoId: 'doc', camara: { x: 0, y: 0, zoom: 1 }, alAjustes: (a) => { ultimosAjustes = a; } });
}
function ptr(tipo, x, y, { id = 1, pointerType = 'mouse', pressure, shiftKey = false } = {}) {
  const e = new dom.window.MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, shiftKey });
  Object.defineProperty(e, 'pointerId', { value: id }); Object.defineProperty(e, 'pointerType', { value: pointerType });
  if (pressure !== undefined) Object.defineProperty(e, 'pressure', { value: pressure });
  canvas.dispatchEvent(e);
}
const pluma = { pointerType: 'pen' };
const trazar = (a, b, o = {}) => { ptr('pointerdown', a[0], a[1], o); ptr('pointermove', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 5, o); ptr('pointermove', b[0], b[1], o); ptr('pointerup', b[0], b[1], o); };
const trazos = () => escena.lista().filter((e) => e.tipo === 'trazo');

test('el lápiz con mouse dibuja un trazo que se puede deshacer', () => {
  nuevo(); motor.setHerramienta('lapiz');
  trazar([100, 100], [300, 120]);
  assert.equal(trazos().length, 1);
  const t = trazos()[0];
  assert.ok(t.datos.puntos.length >= 2 && t.datos.color === '#14192b' && t.datos.variable === false);
  assert.ok(t.ancho > 190 && t.alto > 3);
  motor.deshacer(); assert.equal(trazos().length, 0);
  motor.rehacer(); assert.equal(trazos().length, 1);
});

test('con lápiz táctil se guarda la presión y el grosor es variable', () => {
  nuevo(); motor.setHerramienta('lapiz');
  ptr('pointerdown', 50, 50, { ...pluma, pressure: 0.2 }); ptr('pointermove', 100, 60, { ...pluma, pressure: 0.9 }); ptr('pointermove', 150, 50, { ...pluma, pressure: 0.6 }); ptr('pointerup', 150, 50, { ...pluma, pressure: 0 });
  const t = trazos()[0];
  assert.equal(t.datos.variable, true);
  assert.ok(new Set(t.datos.puntos.map((p) => p[2])).size >= 2);
});

test('el resaltador es translúcido y de grosor uniforme', () => {
  nuevo(); motor.setHerramienta('resaltador');
  trazar([100, 200], [300, 200], pluma);
  const t = trazos()[0];
  assert.equal(t.datos.opacidad, 0.4); assert.equal(t.datos.variable, false); assert.equal(t.datos.herramienta, 'resaltador');
});

test('colores, grosor y opacidad se configuran y se avisan para guardarlos', () => {
  nuevo(); motor.setHerramienta('lapiz');
  motor.configurar('lapiz', { color: '#d6336c', grosor: 9, opacidad: 0.5 });
  assert.equal(ultimosAjustes.lapiz.color, '#d6336c');
  trazar([100, 100], [200, 100]);
  const d = trazos()[0].datos;
  assert.deepEqual([d.color, d.grosor, d.opacidad], ['#d6336c', 9, 0.5]);
});

test('el grosor del trazo es el mismo en el mundo con cualquier zoom', () => {
  nuevo(); motor.setHerramienta('lapiz'); motor.configurar('lapiz', { grosor: 4 });
  motor.zoomPaso(2);
  trazar([100, 100], [200, 100]);
  assert.equal(trazos()[0].datos.grosor, 4); // no se divide por el zoom: al acercar se ve más grueso
  motor.zoomPaso(0.5); motor.zoomReal();
  trazar([100, 200], [200, 200]);
  assert.equal(trazos()[1].datos.grosor, 4);
});
test('rechazo de palma: un toque mientras el lápiz escribe no mueve nada ni corta el trazo', () => {
  nuevo(); motor.setHerramienta('lapiz');
  const c0 = { ...motor.camara };
  ptr('pointerdown', 100, 100, { ...pluma, id: 1, pressure: 0.5 });
  ptr('pointerdown', 400, 400, { id: 2, pointerType: 'touch' }); // la palma se apoya
  ptr('pointermove', 450, 420, { id: 2, pointerType: 'touch' });
  ptr('pointermove', 200, 110, { ...pluma, id: 1, pressure: 0.5 });
  ptr('pointerup', 450, 420, { id: 2, pointerType: 'touch' });
  ptr('pointermove', 300, 120, { ...pluma, id: 1, pressure: 0.5 });
  ptr('pointerup', 300, 120, { ...pluma, id: 1 });
  assert.deepEqual(motor.camara, c0);
  assert.equal(trazos().length, 1);
  assert.ok(trazos()[0].ancho > 190);
});

test('si la palma se apoya antes que el lápiz, el lápiz gana', () => {
  nuevo(); motor.setHerramienta('lapiz');
  const c0 = { ...motor.camara };
  ptr('pointerdown', 400, 400, { id: 2, pointerType: 'touch' });
  ptr('pointerdown', 100, 100, { ...pluma, id: 1, pressure: 0.5 });
  ptr('pointermove', 420, 440, { id: 2, pointerType: 'touch' });
  ptr('pointermove', 200, 100, { ...pluma, id: 1, pressure: 0.5 });
  ptr('pointerup', 200, 100, { ...pluma, id: 1 });
  ptr('pointerup', 420, 440, { id: 2, pointerType: 'touch' });
  assert.deepEqual(motor.camara, c0); assert.equal(trazos().length, 1);
});

test('con lápiz detectado el dedo mueve el lienzo; se puede volver a dibujar con el dedo', () => {
  nuevo(); motor.setHerramienta('lapiz');
  assert.equal(motor.dedoDibuja, true);
  ptr('pointermove', 10, 10, { ...pluma, id: 9 }); // el lápiz pasa cerca de la pantalla
  assert.equal(motor.dedoDibuja, false); assert.equal(motor.hayLapiz, true);
  const x0 = motor.camara.x;
  trazar([300, 300], [200, 300], { id: 3, pointerType: 'touch' });
  assert.equal(trazos().length, 0); assert.ok(motor.camara.x > x0);
  motor.setDedoDibuja(true);
  trazar([300, 300], [200, 300], { id: 4, pointerType: 'touch' });
  assert.equal(trazos().length, 1);
});

test('mientras se escribe, la rueda no mueve la cámara', () => {
  nuevo(); motor.setHerramienta('lapiz');
  ptr('pointerdown', 100, 100); ptr('pointermove', 150, 120);
  assert.ok(motor._cache); // el fondo ya dibujado se reutiliza para escribir sin retraso
  const z = motor.camara.zoom;
  canvas.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -200, clientX: 100, clientY: 100, cancelable: true }));
  assert.equal(motor.camara.zoom, z);
  ptr('pointerup', 150, 120);
  assert.equal(motor._cache, null);
});

test('borrador de trazo completo: borra solo lo que toca y se deshace', () => {
  nuevo(); motor.setHerramienta('lapiz');
  trazar([100, 100], [300, 100]); trazar([100, 400], [300, 400]);
  assert.equal(trazos().length, 2);
  motor.setHerramienta('borrador'); motor.configurar('borrador', { modo: 'trazo', tamano: 30 });
  ptr('pointerdown', 200, 103); ptr('pointermove', 210, 110); ptr('pointerup', 210, 110);
  assert.equal(trazos().length, 1); assert.ok(trazos()[0].y > 300);
  motor.deshacer(); assert.equal(trazos().length, 2);
  motor.rehacer(); assert.equal(trazos().length, 1);
});

test('borrador por zona: corta el trazo en dos y deshacer lo devuelve entero', () => {
  nuevo(); motor.setHerramienta('lapiz');
  trazar([100, 100], [500, 100]);
  const original = trazos()[0];
  motor.setHerramienta('borrador'); motor.configurar('borrador', { modo: 'zona', tamano: 40 });
  ptr('pointerdown', 300, 103); ptr('pointerup', 300, 103);
  const piezas = trazos();
  assert.equal(piezas.length, 2);
  assert.ok(piezas[0].x + piezas[0].ancho < 300 && piezas[1].x > 300);
  assert.ok(piezas.every((p) => p.datos.color === original.datos.color && p.z === original.z));
  motor.deshacer();
  assert.deepEqual(trazos().map((t) => t.id), [original.id]);
  motor.rehacer(); assert.equal(trazos().length, 2);
});

test('el borrador no toca las figuras', () => {
  nuevo(); motor.setHerramienta('rectangulo');
  trazar([100, 100], [200, 200]);
  motor.setHerramienta('borrador'); ptr('pointerdown', 150, 150); ptr('pointerup', 150, 150);
  assert.equal(escena.mapa.size, 1);
});

test('finalizarGestoEnCurso guarda el trazo que se estaba dibujando sin esperar a pointerup', () => {
  nuevo(); motor.setHerramienta('lapiz');
  ptr('pointerdown', 50, 50);
  ptr('pointermove', 120, 130);
  assert.equal(trazos().length, 0); // mientras se mueve aún está en curso
  motor.finalizarGestoEnCurso();
  assert.equal(trazos().length, 1); // ahora el trazo quedó consolidado en la escena
  assert.equal(motor.gesto, null);
});

test('espacio en modo teclado directo empieza a escribir texto', () => {
  nuevo();
  motor.escritura = 'teclado';
  motor.setHerramienta('seleccionar');
  const ev = new dom.window.KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true });
  dom.window.dispatchEvent(ev);
  assert.ok(motor.editor); // abrió el editor de texto
  motor.cerrarTexto();
});

test.after(() => { motor?.destruir(); dom.window.close(); });

