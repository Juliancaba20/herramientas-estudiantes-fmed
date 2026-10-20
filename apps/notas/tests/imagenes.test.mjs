import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BYTES_IMAGEN, MAX_LADO_IMAGEN, dimensionesReducidas, procesarImagen } from '../src/herramientas/imagenes/procesar.js';
import { pintarImagen, recorteImagenSeguro } from '../src/lienzo/dibujo.js';

test('limita el lado mayor y conserva la proporción', () => {
  const dimensiones = dimensionesReducidas(6000, 3000);
  assert.deepEqual(dimensiones, { ancho: MAX_LADO_IMAGEN, alto: MAX_LADO_IMAGEN / 2 });
});

test('reduce también por peso y deja intactas las imágenes pequeñas', () => {
  assert.deepEqual(dimensionesReducidas(1000, 500, MAX_BYTES_IMAGEN * 4), { ancho: 500, alto: 250 });
  assert.deepEqual(dimensionesReducidas(640, 480, 100_000), { ancho: 640, alto: 480 });
});

test('rechaza dimensiones imposibles', () => {
  assert.throws(() => dimensionesReducidas(0, 100), /dimensiones/);
});

test('normaliza el recorte y pinta solo la región seleccionada', () => {
  assert.deepEqual(recorteImagenSeguro({ x: 0.2, y: 0.1, ancho: 0.5, alto: 0.6 }), { x: 0.2, y: 0.1, ancho: 0.5, alto: 0.6 });
  assert.deepEqual(recorteImagenSeguro({ x: -1, y: 0.8, ancho: 4, alto: 1 }), { x: 0, y: 0.8, ancho: 1, alto: 0.19999999999999996 });
  const llamadas = [];
  const ctx = { drawImage: (...args) => llamadas.push(args), fillRect() {}, strokeRect() {}, set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {} };
  const imagen = { naturalWidth: 1000, naturalHeight: 500 };
  pintarImagen(ctx, { x: 20, y: 30, ancho: 200, alto: 100, datos: { recorte: { x: 0.25, y: 0.2, ancho: 0.5, alto: 0.6 } } }, imagen);
  assert.deepEqual(llamadas[0].slice(1), [250, 100, 500, 300, 20, 30, 200, 100]);
});

test('rechaza formatos no admitidos con un mensaje claro en español', async () => {
  await assert.rejects(
    () => procesarImagen({ type: 'application/pdf', size: 100, name: 'documento.pdf' }),
    /Use una imagen PNG, JPEG o WebP\./,
  );
  await assert.rejects(
    () => procesarImagen(null),
    /Use una imagen PNG, JPEG o WebP\./,
  );
});