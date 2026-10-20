import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarSimbolos,
  registrarSimbolo,
  CATEGORIAS,
  SIMBOLOS,
} from '../src/herramientas/simbolos/catalogo.js';

test('el catálogo contiene al menos 250 símbolos útiles y ningún duplicado', () => {
  assert.ok(SIMBOLOS.length >= 250, `Se esperaban >= 250 símbolos pero hay ${SIMBOLOS.length}`);
  const unicos = new Set(SIMBOLOS.map((s) => s.caracter));
  assert.equal(unicos.size, SIMBOLOS.length, 'No debe haber ningún símbolo duplicado en el catálogo');
});

test('las categorías existen y contienen elementos', () => {
  const categoriasValidas = new Set(CATEGORIAS.map((c) => c.id).filter((id) => id !== 'todas'));
  for (const s of SIMBOLOS) {
    assert.ok(categoriasValidas.has(s.categoria), `La categoría "${s.categoria}" de "${s.caracter}" debe ser válida`);
  }
  for (const catId of categoriasValidas) {
    const elementos = SIMBOLOS.filter((s) => s.categoria === catId);
    assert.ok(elementos.length > 0, `La categoría "${catId}" debe tener elementos`);
  }
});

test('busca símbolos por nombre, categoría y término científico sin importar mayúsculas ni tildes', () => {
  // Con tilde y sin tilde
  assert.ok(buscarSimbolos('alfa').some((s) => s.caracter === 'α'));
  assert.ok(buscarSimbolos('ALFA').some((s) => s.caracter === 'α'));
  assert.ok(buscarSimbolos('épsilon').some((s) => s.caracter === 'ε'));
  assert.ok(buscarSimbolos('epsilon').some((s) => s.caracter === 'ε'));
  assert.ok(buscarSimbolos('raíz').some((s) => s.caracter === '√'));
  assert.ok(buscarSimbolos('raiz').some((s) => s.caracter === '√'));
  assert.ok(buscarSimbolos('sumatoria').some((s) => s.caracter === '∑'));
  assert.ok(buscarSimbolos('integral').some((s) => s.caracter === '∫'));
  assert.ok(buscarSimbolos('ohm').some((s) => s.caracter === 'Ω'));
  assert.ok(buscarSimbolos('receta').some((s) => s.caracter === '℞'));
  assert.ok(buscarSimbolos('superíndice').some((s) => s.caracter === '²'));
  assert.ok(buscarSimbolos('subíndice').some((s) => s.caracter === '₂'));
  assert.equal(buscarSimbolos('termino_inexistente_xyz').length, 0);
});

test('filtra correctamente por categoría', () => {
  const griegos = buscarSimbolos('', 'griego');
  assert.ok(griegos.every((s) => s.categoria === 'griego'));
  assert.ok(griegos.some((s) => s.caracter === 'α'));

  const flechas = buscarSimbolos('', 'flechas');
  assert.ok(flechas.every((s) => s.categoria === 'flechas'));
  assert.ok(flechas.some((s) => s.caracter === '→'));

  const subsuper = buscarSimbolos('', 'subsuper');
  assert.ok(subsuper.every((s) => s.categoria === 'subsuper'));
  assert.ok(subsuper.some((s) => s.caracter === '²'));
  assert.ok(subsuper.some((s) => s.caracter === '₂'));
});

test('prioriza los más usados y limita la lista de frecuencia', () => {
  let usados = [];
  usados = registrarSimbolo(usados, 'β');
  usados = registrarSimbolo(usados, 'α');
  usados = registrarSimbolo(usados, 'β');
  assert.equal(buscarSimbolos('', 'todas', usados)[0].caracter, 'β');
  for (const simbolo of SIMBOLOS) usados = registrarSimbolo(usados, simbolo.caracter);
  assert.equal(usados.length, 12);
});
