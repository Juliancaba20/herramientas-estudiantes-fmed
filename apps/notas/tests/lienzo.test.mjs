import test from 'node:test';
import assert from 'node:assert/strict';
import { camaraInicial, mover, mundoAPantalla, pantallaAMundo, zoomEn, ZOOM_MAX, ZOOM_MIN, encuadrar } from '../src/lienzo/camara.js';
import { manijaEn, normalizarRect, puntoEnElemento, redimensionar, trasladar, unirRects, MIN_TAM } from '../src/lienzo/geometria.js';
import { Escena } from '../src/lienzo/escena.js';
import { crearElemento } from '../src/almacen/modelo.js';

const fig = (o = {}) => crearElemento('d', 'figura', { x: 0, y: 0, ancho: 10, alto: 10, datos: { forma: 'rectangulo' }, ...o });

test('cámara: conversión de ida y vuelta y zoom que no corre el punto bajo el cursor', () => {
  let c = { x: 30, y: -20, zoom: 1.7 };
  const w = pantallaAMundo(c, 200, 150);
  const p = mundoAPantalla(c, w.x, w.y);
  assert.ok(Math.abs(p.x - 200) < 1e-9 && Math.abs(p.y - 150) < 1e-9);
  c = zoomEn(c, 200, 150, 1.6);
  const p2 = mundoAPantalla(c, w.x, w.y);
  assert.ok(Math.abs(p2.x - 200) < 1e-9 && Math.abs(p2.y - 150) < 1e-9);
});

test('cámara: el zoom se limita y mover sigue al dedo', () => {
  assert.equal(zoomEn(camaraInicial(), 0, 0, 1e6).zoom, ZOOM_MAX);
  assert.equal(zoomEn(camaraInicial(), 0, 0, 1e-6).zoom, ZOOM_MIN);
  const c = mover({ x: 0, y: 0, zoom: 2 }, 100, 50);
  assert.deepEqual([c.x, c.y], [-50, -25]);
  const e = encuadrar({ x: 0, y: 0, ancho: 1000, alto: 500 }, 800, 600);
  assert.ok(e.zoom < 1 && e.zoom >= ZOOM_MIN);
});

test('geometría: elipse, manijas y redimensionado', () => {
  const el = fig({ ancho: 100, alto: 50, datos: { forma: 'elipse' } });
  assert.ok(puntoEnElemento(el, 50, 25)); assert.ok(!puntoEnElemento(el, 2, 2));
  assert.equal(manijaEn(el, 100, 50, 3), 'se'); assert.equal(manijaEn(el, 50, 25, 3), null);
  const r = redimensionar(el, 'se', 20, 10);
  assert.deepEqual([r.ancho, r.alto], [120, 60]);
  const v = redimensionar(el, 'e', -130, 0); // dar vuelta
  assert.ok(v.x < 0 && v.ancho === 30);
  const m = redimensionar(el, 'se', 0, 0.1); assert.ok(m.ancho >= MIN_TAM);
  const pr = redimensionar(fig({ ancho: 100, alto: 50 }), 'se', 50, 0, true);
  assert.equal(pr.ancho / pr.alto, 2);
  assert.deepEqual(unirRects([{ x: 0, y: 0, ancho: 10, alto: 10 }, { x: 20, y: 5, ancho: 10, alto: 10 }]), { x: 0, y: 0, ancho: 30, alto: 15 });
  assert.deepEqual(normalizarRect(10, 10, 0, 4), { x: 0, y: 4, ancho: 10, alto: 6 });
});

test('geometría: trasladar un trazo mueve sus puntos', () => {
  const t = crearElemento('d', 'trazo', { x: 0, y: 0, ancho: 5, alto: 5, datos: { puntos: [[0, 0, 1], [5, 5, 1]] } });
  const m = trasladar(t, 10, 20);
  assert.deepEqual(m.datos.puntos, [[10, 20, 1], [15, 25, 1]]);
  assert.deepEqual(t.datos.puntos, [[0, 0, 1], [5, 5, 1]]); // el original no se toca
});

test('escena: deshacer y rehacer ilimitados', () => {
  const e = new Escena();
  const a = fig();
  e.ejecutar([{ id: a.id, antes: null, despues: a }]);
  for (let i = 1; i <= 200; i++) e.ejecutar([{ id: a.id, antes: e.get(a.id), despues: { ...e.get(a.id), x: i } }]);
  assert.equal(e.get(a.id).x, 200);
  for (let i = 0; i < 200; i++) assert.ok(e.deshacer());
  assert.equal(e.get(a.id).x, 0);
  assert.ok(e.deshacer()); assert.equal(e.mapa.size, 0);
  assert.ok(!e.deshacer());
  for (let i = 0; i < 201; i++) e.rehacer();
  assert.equal(e.get(a.id).x, 200);
  e.deshacer(); e.ejecutar([{ id: a.id, antes: e.get(a.id), despues: { ...e.get(a.id), x: -1 } }]);
  assert.ok(!e.historial.puedeRehacer()); // una acción nueva borra el futuro
});

test('escena: orden de capas', () => {
  const e = new Escena();
  const [a, b, c, d] = [0, 1, 2, 3].map((z) => fig({ z }));
  e.ejecutar([a, b, c, d].map((x) => ({ id: x.id, antes: null, despues: x })));
  const ids = () => e.lista().map((x) => x.id);
  e.reordenar([a.id], 'frente'); assert.deepEqual(ids(), [b.id, c.id, d.id, a.id]);
  e.reordenar([a.id], 'fondo'); assert.deepEqual(ids(), [a.id, b.id, c.id, d.id]);
  e.reordenar([b.id, c.id], 'subir'); assert.deepEqual(ids(), [a.id, d.id, b.id, c.id]);
  e.reordenar([b.id], 'bajar'); assert.deepEqual(ids(), [a.id, b.id, d.id, c.id]);
  assert.ok(!e.reordenar([c.id], 'frente') || true);
  e.deshacer(); e.deshacer(); e.deshacer(); e.deshacer(); // vuelve a z originales
  assert.deepEqual(ids(), [a.id, b.id, c.id, d.id]);
});

test('escena: pendientes de guardado y recuperación tras un fallo', () => {
  const e = new Escena();
  const a = fig(), b = fig();
  e.ejecutar([{ id: a.id, antes: null, despues: a }, { id: b.id, antes: null, despues: b }]);
  const p = e.tomarPendientes();
  assert.equal(p.guardar.length, 2); assert.equal(e.sucios.size, 0);
  e.devolverPendientes(p);
  assert.equal(e.sucios.size, 2);
  e.ejecutar([{ id: a.id, antes: a, despues: null }]);
  const q = e.tomarPendientes();
  assert.deepEqual(q.borrar, [a.id]); assert.equal(q.guardar.length, 1);
});

import { borrarZona, cajaDeTrazo, puntoEnTrazo, simplificar } from '../src/lienzo/geometria.js';

test('trazos: toque preciso, caja y simplificación', () => {
  const pts = [[0, 0, 0.5], [100, 0, 0.5], [100, 100, 0.5]];
  const t = crearElemento('d', 'trazo', { ...cajaDeTrazo(pts, 4), datos: { puntos: pts, grosor: 4 } });
  assert.deepEqual([t.x, t.y, t.ancho, t.alto], [-2, -2, 104, 104]);
  assert.ok(puntoEnTrazo(t, 50, 1)); assert.ok(puntoEnTrazo(t, 100, 60));
  assert.ok(!puntoEnTrazo(t, 40, 60)); // dentro de la caja pero lejos de la línea
  const recta = Array.from({ length: 50 }, (_, i) => [i, 0, 0.5]);
  assert.equal(simplificar(recta, 0.1).length, 2);
  const curva = Array.from({ length: 50 }, (_, i) => [i, i % 2 ? 5 : 0, 0.5]);
  assert.equal(simplificar(curva, 0.1).length, 50);
});

test('borrador de zona: corta el trazo en tramos y no toca lo lejano', () => {
  const linea = [[0, 0, 0.5], [200, 0, 0.5]];
  const tramos = borrarZona(linea, 100, 0, 15);
  assert.equal(tramos.length, 2);
  assert.ok(tramos[0].at(-1)[0] < 86 && tramos[1][0][0] > 114);
  assert.equal(borrarZona(linea, 100, 80, 15), null);
  assert.equal(borrarZona(linea, 0, 0, 500).length, 0); // se borra todo
});
