import test from 'node:test';
import assert from 'node:assert/strict';
import { crearActualizador, guardarTodoAntesDeActualizar } from '../src/pwa/actualizador.js';
import { EVENTO_GUARDAR_TODO } from '../src/pwa/gestor.js';

function entorno({ hallada = { version: '1.2.0', notas: 'mejoras', fallaInstalar: false }, fallaBuscar = false } = {}) {
  const orden = [];
  const api = {
    buscar: async () => {
      orden.push('buscar');
      if (fallaBuscar) throw new Error('sin red');
      if (!hallada) return null;
      return {
        version: hallada.version, notas: hallada.notas,
        instalar: async (avance) => {
          orden.push('instalar');
          avance({ evento: 'Started', datos: { contentLength: 1000 } });
          avance({ evento: 'Progress', datos: { chunkLength: 500 } });
          avance({ evento: 'Finished' });
          if (hallada.fallaInstalar) throw new Error('firma inválida');
        },
      };
    },
    reiniciar: async () => { orden.push('reiniciar'); },
  };
  const act = crearActualizador({ api, guardarTodo: async () => { orden.push('guardar'); } });
  return { act, orden };
}

test('sin versión nueva no se muestra nada', async () => {
  const { act } = entorno({ hallada: null });
  assert.equal((await act.consultar()).fase, 'nada');
});

test('sin conexión o sin publicación la consulta es silenciosa', async () => {
  const { act } = entorno({ fallaBuscar: true });
  const e = await act.consultar();
  assert.equal(e.fase, 'nada');
  assert.equal(e.error, '');
});

test('con versión nueva se avisa y la persona elige cuándo instalarla', async () => {
  const { act, orden } = entorno();
  const e = await act.consultar();
  assert.deepEqual([e.fase, e.version], ['lista', '1.2.0']);
  assert.deepEqual(orden, ['buscar'], 'consultar no instala nada por su cuenta');
});

test('instalar guarda todo primero, luego instala y reinicia, en ese orden', async () => {
  const { act, orden } = entorno();
  await act.consultar();
  assert.equal(await act.instalar(), true);
  assert.deepEqual(orden, ['buscar', 'guardar', 'instalar', 'reiniciar']);
  assert.equal(act.estado().progreso, 100);
});

test('si la instalación falla (por ejemplo, firma inválida) no se reinicia y se puede reintentar', async () => {
  const { act, orden } = entorno({ hallada: { version: '1.2.0', notas: '', fallaInstalar: true } });
  await act.consultar();
  assert.equal(await act.instalar(), false);
  assert.ok(!orden.includes('reiniciar'));
  assert.equal(act.estado().fase, 'lista');
  assert.match(act.estado().error, /sus notas están a salvo/i);
});

test('instalar sin una versión encontrada no hace nada', async () => {
  const { act, orden } = entorno({ hallada: null });
  assert.equal(await act.instalar(), false);
  assert.deepEqual(orden, []);
});

test('guardarTodoAntesDeActualizar espera a los editores y recién después vacía los archivos', async () => {
  const orden = [];
  const oyentes = [];
  const win = {
    CustomEvent: class { constructor(tipo, init) { this.type = tipo; this.detail = init.detail; } },
    dispatchEvent(ev) {
      assert.equal(ev.type, EVENTO_GUARDAR_TODO);
      ev.detail.promesas.push(new Promise((r) => setTimeout(() => { orden.push('editor guardó'); r(); }, 15)));
      return true;
    },
  };
  await guardarTodoAntesDeActualizar(win, async () => { orden.push('archivos'); });
  assert.deepEqual(orden, ['editor guardó', 'archivos']);
  void oyentes;
});
