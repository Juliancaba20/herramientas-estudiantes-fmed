import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/estilos/editor.css', import.meta.url), 'utf8');
const leer = (ruta) => readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8');

test('el cuadro de texto en edición tiene fondo transparente (se ven los renglones y lo de atrás)', () => {
  const regla = css.split('\n').find((l) => l.startsWith('.nt-texto-ed {'));
  assert.ok(regla, 'falta la regla .nt-texto-ed');
  assert.match(regla, /background:\s*transparent/);
  assert.doesNotMatch(regla, /background:\s*rgba?\(255/);
});

test('los tres editores ponen zoom y barras inferiores dentro del mismo dock', () => {
  for (const f of ['app/EditorLienzo.jsx', 'formatos/EditorTarjetas.jsx', 'formatos/EditorPaginas.jsx']) {
    const src = leer(f);
    const dock = src.indexOf('className="nt-hud-pie"');
    assert.ok(dock > 0, `${f}: falta el dock`);
    assert.ok(src.indexOf('className="nt-zoom"') > dock, `${f}: el zoom debe ir dentro del dock`);
  }
});

test('todas las piezas del dock comparten la misma altura mínima', () => {
  assert.match(css, /--nt-hud-alto:\s*52px/);
  for (const sel of ['.nt-hud-pie .nt-zoom', '.nt-hud-pie .nt-barra-tarjetas', '.nt-hud-pie .nt-barra-paginas']) assert.ok(css.includes(sel), sel);
  assert.match(css, /min-height:\s*var\(--nt-hud-alto\)/);
});

test('con «Mover el lienzo», el doble clic escribe (se prepara en el paneo y se resuelve al soltar)', () => {
  const motor = leer('lienzo/motor.js');
  assert.match(motor, /this\.herramienta === 'mano'[^\n]*_prepararDobleClicMano/);
  assert.match(motor, /g\.tipo === 'paneo' && g\.inicioPantalla/);
  assert.match(motor, /_soltarPaneoMano\(g, e\)/);
});
