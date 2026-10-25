import test from 'node:test';
import assert from 'node:assert/strict';
import { crearGestorDisco, nombreDeRuta, CLAVE_RUTAS } from '../src/archivos/disco.js';

// Disco y almacén de mentira, para probar la lógica sin Tauri ni IndexedDB
function entorno({ docs = {}, rutas = {}, sinPreguntar = [], fallaEscritura = false, archivosExistentes = null } = {}) {
  const ajustes = { [CLAVE_RUTAS]: rutas, 'disco.sinPreguntar': sinPreguntar };
  const archivos = new Map(); // ruta → bytes
  const registro = { dialogoGuardar: [], escrituras: [] };
  let reloj = 1000;
  let proximaRutaGuardar = 'C:\\Notas\\Anatomía.nota';
  let proximosElegidos = [];
  const api = {
    elegirDondeGuardar: async ({ nombre }) => { registro.dialogoGuardar.push(nombre); return proximaRutaGuardar; },
    elegirArchivos: async () => proximosElegidos,
    escribir: async (ruta, bytes) => { if (fallaEscritura) throw new Error('acceso denegado'); registro.escrituras.push(ruta); archivos.set(ruta, bytes); },
    leer: async (ruta) => archivos.get(ruta) || new Uint8Array([1, 2, 3]),
    existe: async (ruta) => (archivosExistentes ? archivosExistentes.includes(ruta) : archivos.has(ruta) || true),
  };
  const gestor = crearGestorDisco({
    api,
    leerAjuste: async (k, d) => (k in ajustes ? ajustes[k] : d),
    guardarAjuste: async (k, v) => { ajustes[k] = JSON.parse(JSON.stringify(v)); },
    obtenerDoc: async (id) => docs[id],
    empaquetar: async (doc) => new TextEncoder().encode(`${doc.titulo}:${doc.modificado}`),
    ahora: () => (reloj += 10),
    esperaMs: 5,
  });
  return {
    gestor, ajustes, archivos, registro, docs,
    elegirRuta: (r) => { proximaRutaGuardar = r; },
    elegirArchivos: (lista) => { proximosElegidos = lista; },
  };
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const texto = (bytes) => new TextDecoder().decode(bytes);

test('nombreDeRuta funciona con rutas de Windows, Mac y Linux', () => {
  assert.equal(nombreDeRuta('C:\\Users\\Ana\\Notas\\Clase 1.nota'), 'Clase 1.nota');
  assert.equal(nombreDeRuta('/Users/ana/Notas/Clase 1.nota'), 'Clase 1.nota');
  assert.equal(nombreDeRuta(''), '');
});

test('«Guardar como» escribe el archivo y vincula el documento a esa ruta', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'Anatomía', modificado: 5 } } });
  const r = await e.gestor.guardarComo(e.docs.a, new TextEncoder().encode('contenido'));
  assert.deepEqual(r, { ruta: 'C:\\Notas\\Anatomía.nota', nombre: 'Anatomía.nota' });
  assert.equal(texto(e.archivos.get('C:\\Notas\\Anatomía.nota')), 'contenido');
  assert.equal(await e.gestor.rutaDe('a'), 'C:\\Notas\\Anatomía.nota');
  assert.equal(e.ajustes[CLAVE_RUTAS].a.ruta, 'C:\\Notas\\Anatomía.nota', 'el vínculo queda guardado para la próxima vez');
  assert.match(e.registro.dialogoGuardar[0], /\.nota$/, 'se propone un nombre con la extensión .nota');
});

test('si la persona cancela la ventana de guardar no se escribe ni se vincula nada', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'X', modificado: 1 } } });
  e.elegirRuta(null);
  assert.equal(await e.gestor.guardarComo(e.docs.a, new Uint8Array([1])), null);
  assert.equal(e.registro.escrituras.length, 0);
  assert.equal(await e.gestor.rutaDe('a'), null);
});

test('en Android «guardar» crea una copia sin vincular', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'X', modificado: 1 } } });
  await e.gestor.guardarComo(e.docs.a, new Uint8Array([1]), { vincular: false });
  assert.equal(e.registro.escrituras.length, 1);
  assert.equal(await e.gestor.rutaDe('a'), null);
});

test('la copia completa se guarda donde la persona elige y no vincula nada', async () => {
  const e = entorno();
  e.elegirRuta('D:\\Respaldos\\copia.anotomia-respaldo');
  const r = await e.gestor.guardarCopia(new Uint8Array([9]), 'Anotomia_Copia.anotomia-respaldo');
  assert.equal(r.nombre, 'copia.anotomia-respaldo');
  assert.deepEqual(e.ajustes[CLAVE_RUTAS], {});
});

test('cada guardado con cambios reescribe el archivo, agrupando los cambios rápidos', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'V1', modificado: 5 } } });
  await e.gestor.guardarComo(e.docs.a, new Uint8Array([0]));
  e.registro.escrituras.length = 0;
  e.docs.a = { id: 'a', titulo: 'V2', modificado: 6 };
  await e.gestor.programarEscritura('a');
  e.docs.a = { id: 'a', titulo: 'V3', modificado: 7 };
  await e.gestor.programarEscritura('a'); // dentro de la espera: cuenta como un solo guardado
  await esperar(40);
  assert.equal(e.registro.escrituras.length, 1);
  assert.equal(texto(e.archivos.get('C:\\Notas\\Anatomía.nota')), 'V3:7', 'queda la última versión');
});

test('un documento sin archivo no escribe nada', async () => {
  const e = entorno({ docs: { b: { id: 'b', titulo: 'Solo biblioteca', modificado: 1 } } });
  await e.gestor.programarEscritura('b');
  await esperar(30);
  assert.equal(e.registro.escrituras.length, 0);
  assert.equal(await e.gestor.escribirYa('b'), false);
});

test('vaciar escribe ya lo que estaba esperando (antes de actualizar o cerrar)', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'V1', modificado: 5 } } });
  await e.gestor.guardarComo(e.docs.a, new Uint8Array([0]));
  e.registro.escrituras.length = 0;
  e.docs.a = { id: 'a', titulo: 'V9', modificado: 9 };
  const gestorLento = e.gestor;
  await gestorLento.programarEscritura('a');
  await gestorLento.vaciar();
  assert.equal(texto(e.archivos.get('C:\\Notas\\Anatomía.nota')), 'V9:9');
});

test('si no se puede escribir se avisa y el vínculo se conserva', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'Clase', modificado: 5 } }, rutas: { a: { ruta: 'C:\\x\\Clase.nota', escrito: 1 } }, fallaEscritura: true });
  const avisos = [];
  e.gestor.suscribirErrores((i) => avisos.push(i));
  assert.equal(await e.gestor.escribirYa('a'), false);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].titulo, 'Clase');
  assert.match(avisos[0].mensaje, /acceso denegado/);
  assert.equal(await e.gestor.rutaDe('a'), 'C:\\x\\Clase.nota');
});

test('al abrir el programa se escribe lo que quedó atrás y se avisa de los archivos que faltan', async () => {
  const e = entorno({
    docs: {
      a: { id: 'a', titulo: 'Atrasada', modificado: 500 },
      b: { id: 'b', titulo: 'Al día', modificado: 50 },
      c: { id: 'c', titulo: 'Archivo borrado', modificado: 60 },
    },
    rutas: {
      a: { ruta: 'C:\\n\\a.nota', escrito: 100 },
      b: { ruta: 'C:\\n\\b.nota', escrito: 100 },
      c: { ruta: 'C:\\n\\c.nota', escrito: 100 },
      huerfana: { ruta: 'C:\\n\\h.nota', escrito: 1 },
    },
    archivosExistentes: ['C:\\n\\a.nota', 'C:\\n\\b.nota', 'C:\\n\\h.nota'],
  });
  const faltantes = await e.gestor.sincronizarAlIniciar();
  assert.deepEqual(faltantes.map((f) => f.id), ['c']);
  assert.deepEqual(e.registro.escrituras, ['C:\\n\\a.nota'], 'solo se reescribe la que estaba atrasada');
  assert.equal(await e.gestor.rutaDe('c'), null, 'el que perdió su archivo queda desvinculado, no se recrea sin avisar');
  assert.equal(await e.gestor.rutaDe('huerfana'), null, 'el vínculo de un documento que ya no existe se limpia');
});

test('«Abrir…» devuelve los archivos elegidos con su ruta, nombre y contenido', async () => {
  const e = entorno();
  e.elegirArchivos(['C:\\n\\uno.nota', '/home/ana/dos.nota']);
  const abiertos = await e.gestor.abrirDialogo();
  assert.deepEqual(abiertos.map((a) => a.nombre), ['uno.nota', 'dos.nota']);
  assert.ok(abiertos[0].bytes instanceof Uint8Array);
  e.elegirArchivos([]);
  assert.deepEqual(await e.gestor.abrirDialogo(), []);
});

test('la pregunta de «¿guardar como archivo?» respeta lo que la persona pidió', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'A', modificado: 1 }, b: { id: 'b', titulo: 'B', modificado: 1 } } });
  assert.equal(await e.gestor.debePreguntar('a'), true);
  await e.gestor.noPreguntarMas('a');
  assert.equal(await e.gestor.debePreguntar('a'), false);
  assert.equal(await e.gestor.debePreguntar('b'), true);
  await e.gestor.guardarComo(e.docs.b, new Uint8Array([1]));
  assert.equal(await e.gestor.debePreguntar('b'), false, 'una nota que ya es archivo no se pregunta');
});

test('dejar de vincular conserva el archivo y quita el vínculo', async () => {
  const e = entorno({ docs: { a: { id: 'a', titulo: 'A', modificado: 1 } } });
  await e.gestor.guardarComo(e.docs.a, new Uint8Array([1]));
  await e.gestor.desvincular('a');
  assert.equal(await e.gestor.rutaDe('a'), null);
  assert.equal(e.archivos.has('C:\\Notas\\Anatomía.nota'), true);
  e.registro.escrituras.length = 0;
  await e.gestor.programarEscritura('a');
  await esperar(30);
  assert.equal(e.registro.escrituras.length, 0);
});
