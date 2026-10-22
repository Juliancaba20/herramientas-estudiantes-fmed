// Texto con teclado (Etapa 6): modelo, conversión HTML, maquetación, tablas e integración con el motor (jsdom).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="c"><canvas id="cv" tabindex="0"></canvas><div id="capa"></div></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.HTMLCanvasElement.prototype.getContext = () => null; // sin canvas real: el medidor usa estimaciones

const M = await import('../src/herramientas/texto/modelo.js');
const H = await import('../src/herramientas/texto/html.js');
const { maquetar } = await import('../src/herramientas/texto/maquetar.js');
const { baseDelPrimerRenglon } = await import('../src/herramientas/texto/pintar.js');
const T = await import('../src/herramientas/texto/tabla.js');
const { Escena } = await import('../src/lienzo/escena.js');
const { Lienzo } = await import('../src/lienzo/motor.js');

// Medidor de mentira: cada carácter mide medio tamaño de letra.
const tamDe = (f) => parseFloat(/([\d.]+)px/.exec(f)[1]);
const medidor = { ancho: (f, t) => t.length * tamDe(f) * 0.5, metricas: (f) => ({ asc: tamDe(f) * 0.95, desc: tamDe(f) * 0.25 }) };
const run = (texto, f = {}) => M.crearRun(texto, f);
const par = (...runs) => ({ tipo: 'parrafo', runs });
const aHtml = (bloques) => { const d = document.createElement('div'); d.innerHTML = H.modeloAHtml(bloques); return d; };
const ida = (bloques) => H.domAModelo(aHtml(bloques));

test('colorAHex entiende los formatos habituales y descarta lo transparente', () => {
  assert.equal(H.colorAHex('#abc'), '#aabbcc');
  assert.equal(H.colorAHex('rgb(35, 80, 216)'), '#2350d8');
  assert.equal(H.colorAHex('rgba(0,0,0,0)'), null);
  assert.equal(H.colorAHex('transparent'), null);
  assert.equal(H.colorAHex('Yellow'), '#ffff00');
  assert.equal(H.colorAHex('url(javascript:alert(1))'), null);
});

test('ida y vuelta modelo → HTML → modelo conserva formato, listas, alineación y saltos', () => {
  const bloques = [
    { tipo: 'titulo1', runs: [run('Título')] },
    par(run('Hola '), run('mundo', { negrita: true, cursiva: true }), run(' y ', {}), run('fin', { subrayado: true, tachado: true, color: '#d6336c', resaltado: '#ffe066' })),
    { tipo: 'parrafo', alinear: 'centro', runs: [run('uno\ndos')] },
    { tipo: 'vineta', nivel: 0, runs: [run('a')] },
    { tipo: 'vineta', nivel: 1, runs: [run('a1')] },
    { tipo: 'numero', nivel: 1, runs: [run('n1')] },
    { tipo: 'vineta', nivel: 0, runs: [run('b')] },
    { tipo: 'numero', nivel: 0, runs: [run('uno')] },
    par(),
    par(run('final')),
  ];
  assert.deepEqual(ida(bloques), bloques);
});

test('una línea en blanco al final del bloque se conserva gracias al marcador <br>', () => {
  const b = [par(run('a\n'))];
  assert.deepEqual(ida(b), b);
});

test('las tablas hacen ida y vuelta, con y sin encabezado', () => {
  const tabla = (enc) => ({ tipo: 'tabla', encabezado: enc, filas: [[{ runs: [run('A', { negrita: true })] }, { runs: [] }], [{ runs: [run('x\ny')] }, { runs: [run('z')] }]] });
  assert.deepEqual(ida([par(run('antes')), tabla(true), par(run('después'))]), [par(run('antes')), tabla(true), par(run('después'))]);
  assert.deepEqual(ida([tabla(false)]), [tabla(false)]);
});

test('pegar desde Word: párrafos, negrita, listas con marcas y títulos', () => {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head><body><!--StartFragment-->
    <h1>Resumen</h1>
    <p class=MsoNormal>Texto <b>importante</b><span style='mso-spacerun:yes'>  </span>y <i>otro</i><o:p></o:p></p>
    <p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>·<span>&nbsp;&nbsp;</span></span><![endif]>Primero</p>
    <p class=MsoListParagraph style='mso-list:l1 level2 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span><![endif]>Anidado</p>
    <!--EndFragment--></body></html>`;
  const b = H.htmlAModelo(html);
  assert.equal(b[0].tipo, 'titulo1');
  assert.deepEqual(b[1].runs.map((r) => [r.texto, !!r.negrita, !!r.cursiva]), [['Texto ', false, false], ['importante', true, false], [' y ', false, false], ['otro', false, true]]);
  assert.deepEqual([b[2].tipo, b[2].nivel, M.textoDeRuns(b[2].runs)], ['vineta', 0, 'Primero']);
  assert.deepEqual([b[3].tipo, b[3].nivel, M.textoDeRuns(b[3].runs)], ['numero', 1, 'Anidado']);
  assert.equal(b.length, 4);
});

test('pegar desde Google Docs y desde una web: se aplana lo irrelevante y se descartan scripts y atributos', () => {
  const gdocs = `<meta charset='utf-8'><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr" style="text-align:center"><span style="font-weight:700;color:#ff0000">Rojo</span></p><ul><li dir="ltr"><p dir="ltr"><span>Uno</span></p></li><li><p><span>Dos</span></p><ul><li><p>Sub</p></li></ul></li></ul></b>`;
  const b = H.htmlAModelo(gdocs);
  assert.deepEqual([b[0].alinear, b[0].runs[0].negrita, b[0].runs[0].color], ['centro', true, '#ff0000']);
  assert.deepEqual(b.slice(1).map((x) => [x.tipo, x.nivel, M.textoDeRuns(x.runs)]), [['vineta', 0, 'Uno'], ['vineta', 0, 'Dos'], ['vineta', 1, 'Sub']]);
  const web = '<div onclick="mal()"><script>alert(1)</script><p style="color:rgb(0,0,0);background-color:rgb(255,255,255)">Hola\n   <a href="javascript:x()">enlace</a>   mundo</p><img src=x onerror=alert(1)></div>';
  const w = H.htmlAModelo(web);
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].runs, [{ texto: 'Hola enlace mundo' }]); // espacios colapsados; negro y blanco no se guardan
  assert.ok(!H.modeloAHtml(w).includes('script'));
});

test('el HTML generado escapa el texto y los colores no válidos', () => {
  const h = H.modeloAHtml([par({ texto: '<img src=x onerror=1> & "q"', color: 'red;background:url(x)', negrita: true })]);
  assert.ok(!h.includes('<img'));
  assert.ok(!h.includes('background:url'));
  assert.ok(h.includes('&lt;img'));
});

test('texto plano: viñetas, numeración y sangría', () => {
  const b = M.textoAModelo('Título\n- uno\n  - sub\n1. primero\n\n2) segundo');
  assert.deepEqual(b.map((x) => [x.tipo, x.nivel ?? 0]), [['parrafo', 0], ['vineta', 0], ['vineta', 1], ['numero', 0], ['parrafo', 0], ['numero', 0]]);
  assert.equal(M.modeloATexto(b), 'Título\n• uno\n  • sub\n1. primero\n\n1. segundo');
});

test('sanear tolera datos dañados', () => {
  const b = M.sanear([null, 5, { tipo: 'raro', runs: [{ texto: 3 }, { texto: 'ok', color: 'javascript:1' }] }, { tipo: 'vineta', nivel: 99, runs: 'x' }, { tipo: 'tabla', filas: 'x' }, { tipo: 'tabla', filas: [[{ runs: [{ texto: 'a' }] }], [{ runs: [] }, { runs: [] }]] }]);
  assert.deepEqual(b[0], { tipo: 'parrafo', runs: [{ texto: 'ok' }] });
  assert.deepEqual([b[1].tipo, b[1].nivel], ['vineta', 2]);
  assert.deepEqual(b[2].filas.map((f) => f.length), [2, 2]);
  assert.equal(b.length, 3);
  assert.deepEqual(M.sanear('basura'), []);
});

test('maquetación: corta renglones, parte palabras largas y calcula el alto', () => {
  const datos = { tamano: 10, color: '#000000', bloques: [par(run('aaa bbb ccc'))] };
  // cada letra mide 5; ancho 40 → caben 8 letras: «aaa bbb » y «ccc»
  const L = maquetar(datos, 40, medidor);
  assert.deepEqual(L.textos.map((t) => t.texto), ['aaa bbb', 'ccc']);
  assert.equal(L.alto, 2 * 10 * 1.4);
  const larga = maquetar({ tamano: 10, bloques: [par(run('abcdefghijkl'))] }, 30, medidor);
  assert.deepEqual(larga.textos.map((t) => t.texto), ['abcdef', 'ghijkl']);
  assert.equal(maquetar({ tamano: 20, bloques: [] }, 100, medidor).alto, 28);
});

test('maquetación guiada: líneas y filas de tabla usan múltiplos del interlineado', () => {
  const c = (t) => ({ runs: t ? [run(t)] : [] });
  const datos = {
    composicion: 'guiada', tamano: 20,
    bloques: [par(run('una frase larga para envolver en varias líneas')), { tipo: 'titulo2', runs: [run('Tema')] }, par(run('cierre')), { tipo: 'tabla', filas: [[c('A'), c('B')], [c('varias palabras que envuelven'), c('x')]] }],
  };
  const L = maquetar(datos, 100, medidor, { interlineado: 32 });
  const ys = [...new Set(L.textos.filter((t) => t.texto.trim()).map((t) => t.y))].sort((a, b) => a - b);
  assert.ok(ys.some((y, i) => i > 0 && y - ys[i - 1] === 32));
  const horizontales = L.lineas.filter((l) => l.y1 === l.y2).map((l) => l.y1);
  assert.ok(horizontales.slice(1).every((y, i) => (y - horizontales[i]) % 32 === 0));
  assert.equal(L.alto % 32, 0);
  assert.equal(maquetar({ tamano: 10, bloques: [par(run('a')), par(run('b'))] }, 100, medidor).alto, 32);
});

test('maquetación: una palabra con dos formatos no se parte entre ellos', () => {
  const L = maquetar({ tamano: 10, bloques: [par(run('xx '), run('ho', { negrita: true }), run('la'))] }, 22, medidor);
  assert.deepEqual(L.textos.map((t) => t.texto), ['xx', 'ho', 'la']);
  assert.equal(L.textos[1].y, L.textos[2].y); // «ho» y «la» quedan en el mismo renglón
  assert.ok(L.textos[1].y > L.textos[0].y); // y bajaron juntas
});

test('maquetación: alineación, subrayado, tachado y resaltado', () => {
  const L = maquetar({ tamano: 10, bloques: [{ tipo: 'parrafo', alinear: 'derecha', runs: [run('ab', { subrayado: true, tachado: true, resaltado: '#ffe066' })] }] }, 100, medidor);
  assert.equal(L.textos[0].x, 90);
  assert.equal(L.lineas.length, 2);
  assert.equal(L.fondos.length, 1);
  assert.equal(L.fondos[0].h, 12);
});

test('maquetación: numeración 1. a. i., viñetas por nivel y sangría', () => {
  const l = (tipo, nivel, t) => ({ tipo, nivel, runs: [run(t)] });
  const L = maquetar({ tamano: 10, bloques: [l('numero', 0, 'a'), l('numero', 0, 'b'), l('numero', 1, 'c'), l('numero', 1, 'd'), l('numero', 2, 'e'), l('numero', 0, 'f'), l('vineta', 0, 'g'), l('vineta', 1, 'h')] }, 400, medidor);
  const marcas = L.textos.filter((t) => /^(\d+\.|[a-z]+\.|[•◦▪])$/.test(t.texto)).map((t) => t.texto);
  assert.deepEqual(marcas, ['1.', '2.', 'a.', 'b.', 'i.', '3.', '•', '◦']);
  const xs = L.textos.filter((t) => 'abc'.includes(t.texto)).map((t) => t.x);
  assert.deepEqual(xs, [16, 16, 32]);
});

test('maquetación: tabla con filas parejas, encabezado y bordes', () => {
  const c = (t) => ({ runs: t ? [run(t)] : [] });
  const L = maquetar({ tamano: 10, bloques: [{ tipo: 'tabla', encabezado: true, filas: [[c('A'), c('B')], [c('uno dos tres cuatro cinco'), c('')]] }] }, 100, medidor);
  const horiz = L.lineas.filter((l) => l.y1 === l.y2).map((l) => l.y1);
  assert.equal(horiz.length, 3);
  assert.equal(L.fondos.length, 1); // fila de encabezado
  assert.ok(horiz[2] - horiz[1] > horiz[1] - horiz[0]); // la segunda fila crece al envolver su texto
  assert.equal(L.alto, horiz[2] + 0.5);
  assert.ok(L.textos.find((t) => t.texto === 'A').fuente.startsWith('700'));
});

test('la altura entre bloques no deja hueco al final', () => {
  const L = maquetar({ tamano: 10, bloques: [par(run('a')), par(run('b'))] }, 100, medidor);
  assert.equal(L.alto, 14 + 4 + 14);
});

test('tablas del editor: insertar, filas, columnas y Tab', () => {
  const raiz = document.createElement('div');
  raiz.setAttribute('contenteditable', 'true');
  raiz.innerHTML = '<p>hola</p>';
  document.body.appendChild(raiz);
  const win = dom.window;
  win.getSelection().collapse(raiz.firstChild.firstChild, 2);
  const t = T.insertarTabla(win, raiz, 2, 2);
  assert.equal(raiz.children.length, 3); // párrafo, tabla y párrafo vacío para seguir escribiendo
  assert.equal(raiz.children[2].tagName, 'P');
  const td = t.rows[0].cells[0];
  T.filaMas(win, td, true); assert.equal(t.rows.length, 3);
  T.colMas(win, td, true); assert.equal(t.rows[0].cells.length, 3);
  T.colMenos(win, raiz, td); assert.equal(t.rows[0].cells.length, 2);
  T.celdaVecina(win, t.rows[2].cells[1]); // Tab en la última celda agrega una fila
  assert.equal(t.rows.length, 4);
  T.alternarEncabezado(t.rows[0].cells[0]); assert.equal(t.getAttribute('data-enc'), null);
  while (t.isConnected && raiz.querySelector('table')) T.filaMenos(win, raiz, raiz.querySelector('table').rows[0].cells[0]);
  assert.ok(!raiz.querySelector('table'));
  assert.ok(raiz.firstElementChild);
  raiz.remove();
});

// ---------- integración con el motor ----------
const canvas = document.getElementById('cv');
const capa = document.getElementById('capa');
const rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
canvas.getBoundingClientRect = () => rect;
canvas.parentElement.getBoundingClientRect = () => rect;
canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {};
const falso = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
canvas.getContext = falso;
let escena, motor;
const nuevo = (op = {}) => {
  motor?.destruir();
  escena = new Escena();
  motor = new Lienzo(canvas, { escena, documentoId: 'doc', camara: { x: 0, y: 0, zoom: 1 }, capaTexto: capa, ...op });
};
function ptr(tipo, x, y, { id = 1, pointerType = 'mouse' } = {}) {
  const e = new dom.window.MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(e, 'pointerId', { value: id }); Object.defineProperty(e, 'pointerType', { value: pointerType });
  canvas.dispatchEvent(e);
}
const clic = (x, y) => { ptr('pointerdown', x, y); ptr('pointerup', x, y); };
const escribir = (html) => { motor.editor.raiz.innerHTML = html; motor.editor.raiz.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
const esc = () => motor.editor.raiz.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
const textos = () => escena.lista().filter((e) => e.tipo === 'texto');

test('con la herramienta Texto, un clic abre el editor y Esc deja el texto seleccionado', () => {
  nuevo(); motor.setHerramienta('texto');
  clic(100, 100);
  assert.ok(motor.editor && capa.querySelector('[data-nt-editor]'));
  assert.equal(escena.mapa.size, 0); // todavía no hay nada que guardar
  escribir('<p>Hola <b>mundo</b></p><ul><li>uno</li></ul>');
  esc();
  assert.equal(motor.editor, null);
  assert.equal(capa.querySelector('[data-nt-editor]'), null);
  const [el] = textos();
  assert.equal(M.textoDeRuns(el.datos.bloques[0].runs), 'Hola mundo');
  assert.equal(el.datos.bloques[1].tipo, 'vineta');
  assert.ok(el.alto > 28 && el.ancho >= 80);
  assert.deepEqual([...motor.seleccion], [el.id]);
  assert.equal(motor.herramienta, 'seleccionar');
});

test('un texto vacío no deja nada, y deshacer/rehacer tratan la edición como una sola acción', () => {
  nuevo(); motor.setHerramienta('texto');
  clic(50, 50); esc();
  assert.equal(escena.mapa.size, 0);
  assert.equal(escena.historial.puedeDeshacer(), false);
  clic(50, 50); escribir('<p>uno</p>'); motor.cerrarTexto();
  assert.equal(textos().length, 1);
  motor.editarTexto(textos()[0].id);
  escribir('<p>uno dos</p>'); motor.cerrarTexto();
  assert.equal(M.textoDeRuns(textos()[0].datos.bloques[0].runs), 'uno dos');
  motor.deshacer(); assert.equal(M.textoDeRuns(textos()[0].datos.bloques[0].runs), 'uno');
  motor.deshacer(); assert.equal(textos().length, 0);
  motor.rehacer(); motor.rehacer(); assert.equal(M.textoDeRuns(textos()[0].datos.bloques[0].runs), 'uno dos');
});

test('el punto de control guarda lo escrito mientras se sigue editando', () => {
  nuevo(); motor.setHerramienta('texto');
  clic(60, 60); escribir('<p>borrador</p>');
  assert.equal(textos().length, 0);
  motor.puntoDeControlTexto();
  assert.equal(textos().length, 1);
  assert.ok(escena.sucios.has(textos()[0].id)); // lo recoge el autoguardado
  assert.equal(escena.historial.puedeDeshacer(), false);
  motor.cerrarTexto();
  assert.equal(escena.historial.pasado.length, 1);
});

test('doble clic con Seleccionar edita; un solo clic solo selecciona', () => {
  nuevo(); motor.setHerramienta('texto');
  clic(100, 100); escribir('<p>texto largo para tocar</p>'); motor.cerrarTexto();
  const el = textos()[0];
  motor.setHerramienta('seleccionar');
  motor.seleccion = new Set();
  const x = el.x + 20, y = el.y + 5;
  clic(x, y);
  assert.equal(motor.editor, null);
  clic(x, y);
  assert.ok(motor.editor);
  assert.equal(motor.ocultoId, el.id);
  motor.cerrarTexto();
  assert.equal(motor.ocultoId, null);
});

test('arrastrar con Texto define el ancho; solo se ensancha con las manijas laterales', () => {
  nuevo(); motor.setHerramienta('texto');
  ptr('pointerdown', 100, 100); ptr('pointermove', 200, 110); ptr('pointermove', 340, 120); ptr('pointerup', 340, 120);
  escribir('<p>una frase bastante larga que va a ocupar varios renglones al achicar el ancho</p>');
  motor.cerrarTexto();
  const el = textos()[0];
  assert.equal(el.ancho, 240);
  motor.seleccion = new Set([el.id]); motor.setHerramienta('seleccionar'); motor.seleccion = new Set([el.id]);
  const hx = el.x + el.ancho, hy = el.y + el.alto / 2;
  ptr('pointerdown', hx, hy); ptr('pointermove', hx - 60, hy); ptr('pointermove', hx - 120, hy); ptr('pointerup', hx - 120, hy);
  const r = textos()[0];
  assert.equal(r.ancho, 120);
  assert.ok(r.alto > el.alto);
  assert.equal(r.x, el.x);
  motor.deshacer(); assert.equal(textos()[0].ancho, 240);
});

test('pegar y copiar con el lienzo enfocado', () => {
  nuevo();
  const pegar = (datos) => { const e = new dom.window.Event('paste', { bubbles: true, cancelable: true }); Object.defineProperty(e, 'clipboardData', { value: { getData: (t) => datos[t] || '' } }); window.dispatchEvent(e); return e; };
  const e = pegar({ 'text/html': '<h2>Nota</h2><p>cuerpo <b>fuerte</b></p>', 'text/plain': 'Nota\ncuerpo fuerte' });
  assert.ok(e.defaultPrevented);
  assert.equal(textos().length, 1);
  assert.equal(textos()[0].datos.bloques[0].tipo, 'titulo2');
  assert.deepEqual([...motor.seleccion], [textos()[0].id]);
  let html = '', plano = '';
  const c = new dom.window.Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(c, 'clipboardData', { value: { setData: (t, v) => { if (t === 'text/html') html = v; else plano = v; } } });
  window.dispatchEvent(c);
  assert.ok(html.includes('<h2>Nota</h2>') && html.includes('font-weight:700'));
  assert.equal(plano, 'Nota\ncuerpo fuerte');
  assert.ok(!pegar({ 'text/plain': '   ' }).defaultPrevented);
  assert.equal(textos().length, 1);
});

test('los textos antiguos con { contenido } siguen funcionando y se pueden editar', () => {
  nuevo();
  escena.ejecutar([{ id: 'v', antes: null, despues: { id: 'v', documentoId: 'doc', tipo: 'texto', x: 10, y: 10, ancho: 0, alto: 0, z: 0, contenedor: null, datos: { contenido: 'viejo\nsegundo' }, creado: 1, modificado: 1 } }]);
  const antes = escena.historial.pasado.length;
  motor.editarTexto('v');
  assert.ok(motor.editor.raiz.textContent.includes('viejo') && motor.editor.raiz.textContent.includes('segundo'));
  motor.cerrarTexto();
  assert.equal(escena.historial.pasado.length - antes, 1); // el convertir al formato nuevo cuenta como un cambio
});

test('el modo de escritura limita las herramientas', () => {
  nuevo({ escritura: 'mano' });
  motor.setHerramienta('texto'); assert.equal(motor.herramienta, 'seleccionar');
  nuevo({ escritura: 'teclado' });
  motor.setHerramienta('lapiz'); assert.equal(motor.herramienta, 'seleccionar');
  motor.setHerramienta('texto'); assert.equal(motor.herramienta, 'texto');
  nuevo();
  motor.setHerramienta('lapiz'); assert.equal(motor.herramienta, 'lapiz');
});

test('tocar el lienzo con otra herramienta termina la edición y los atajos no se cuelan al escribir', () => {
  nuevo(); motor.setHerramienta('texto');
  clic(100, 100); escribir('<p>x</p>');
  motor.editor.raiz.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
  motor.editor.raiz.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'v', bubbles: true, cancelable: true }));
  assert.equal(motor.herramienta, 'texto'); // la tecla V escrita en el texto no cambia de herramienta
  motor.setHerramienta('seleccionar');
  assert.equal(motor.editor, null);
  assert.equal(textos().length, 1);
});

test('sin texto seleccionado, teclear no escribe; el doble clic en un lugar vacío crea el texto y convive con trazos', () => {
  nuevo({ estilo: 'rayado', interlineado: 32, activos: true });
  motor.setHerramienta('lapiz');
  ptr('pointerdown', 120, 140, { pointerType: 'pen' });
  ptr('pointermove', 160, 165, { pointerType: 'pen' });
  ptr('pointerup', 160, 165, { pointerType: 'pen' });
  const tecla = new dom.window.KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true });
  window.dispatchEvent(tecla);
  assert.equal(tecla.defaultPrevented, false);
  assert.equal(motor.editor, null); // no hay ningún cursor «listo para escribir» en el lienzo
  motor.setHerramienta('seleccionar');
  clic(300, 300); // un solo clic en un lugar vacío no crea nada
  assert.equal(motor.editor, null);
  motor.cerrarTexto();
  clic(400, 260); clic(400, 260); // doble clic en un lugar vacío
  assert.ok(motor.editor);
  escribir('<p>g</p>');
  assert.equal(M.modeloATexto(motor.editor.leer()), 'g');
  assert.equal(motor.texto.base.datos.composicion, 'guiada');
  assert.equal(motor.renglones.activos, true);
  motor.cerrarTexto();
  assert.equal(textos().length, 1);
  assert.equal(textos()[0].datos.composicion, 'guiada');
  let elGuiado = textos()[0];
  assert.equal((elGuiado.y + baseDelPrimerRenglon(elGuiado.datos, elGuiado.ancho, { interlineado: 32 })) % 32, 0);
  motor.configurarRenglones({ interlineado: 40 });
  elGuiado = textos()[0];
  assert.equal((elGuiado.y + baseDelPrimerRenglon(elGuiado.datos, elGuiado.ancho, { interlineado: 40 })) % 40, 0);
  assert.equal(elGuiado.alto % 40, 0);
  assert.equal(escena.lista().filter((e) => e.tipo === 'trazo').length, 1);
  motor.configurarRenglones({ activos: false });
  clic(500, 520); clic(500, 520);
  assert.ok(motor.editor);
  assert.equal(motor.texto.base.datos.composicion, undefined);
  motor.cerrarTexto();
});

test('con un único texto seleccionado, teclear lo abre y escribe', () => {
  nuevo(); motor.setHerramienta('texto');
  clic(100, 100); escribir('<p>x</p>'); motor.cerrarTexto();
  motor.setHerramienta('seleccionar');
  motor.seleccion = new Set([textos()[0].id]);
  const tecla = new dom.window.KeyboardEvent('keydown', { key: 'y', bubbles: true, cancelable: true });
  window.dispatchEvent(tecla);
  assert.equal(tecla.defaultPrevented, true);
  assert.ok(motor.editor);
  assert.equal(M.modeloATexto(motor.editor.leer()).includes('y'), true);
  motor.cerrarTexto();
});

test('insertar símbolo Unicode conserva el caret del editor de texto', () => {
  nuevo(); motor.setHerramienta('texto'); clic(100, 100);
  assert.equal(motor.insertarSimbolo('α'), true);
  assert.equal(motor.insertarSimbolo('∫'), true);
  assert.equal(M.modeloATexto(motor.editor.leer()), 'α∫');
  motor.cerrarTexto();
  assert.equal(M.modeloATexto(textos()[0].datos.bloques), 'α∫');
});
