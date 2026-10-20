// Operaciones de tabla sobre el DOM del editor (Etapa 6). Son deterministas y no dependen de execCommand.
import { TABLA } from './estilo.js';

const BLOQUE = /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE)$/;

const celdaVacia = (doc) => { const td = doc.createElement('td'); td.appendChild(doc.createElement('br')); return td; };
const parrafoVacio = (doc) => { const p = doc.createElement('p'); p.appendChild(doc.createElement('br')); return p; };

export function crearTabla(doc, filas = 3, cols = 3, encabezado = true) {
  const t = doc.createElement('table');
  if (encabezado) t.setAttribute('data-enc', '1');
  const tb = doc.createElement('tbody');
  for (let r = 0; r < filas; r++) {
    const tr = doc.createElement('tr');
    for (let c = 0; c < cols; c++) tr.appendChild(celdaVacia(doc));
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  return t;
}

// Pone el cursor al final del contenido de un nodo, antes de un <br> de relleno.
export function cursorAlFinal(win, nodo, alInicio = false) {
  const doc = nodo.ownerDocument;
  const r = doc.createRange();
  if (alInicio) { r.setStart(nodo, 0); r.collapse(true); }
  else {
    let n = nodo;
    while (n.lastChild && n.lastChild.nodeType === 1 && n.lastChild.tagName !== 'BR') n = n.lastChild;
    if (n.lastChild && n.lastChild.nodeType === 3) r.setStart(n.lastChild, n.lastChild.nodeValue.length);
    else if (n.lastChild && n.lastChild.tagName === 'BR') r.setStartBefore(n.lastChild);
    else r.setStart(n, n.childNodes.length);
    r.collapse(true);
  }
  const sel = win.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
}

// Envuelve en <p> los nodos sueltos (texto o elementos en línea) que hayan quedado directamente en la raíz.
export function asegurarBloques(raiz) {
  const doc = raiz.ownerDocument;
  let grupo = null;
  for (const n of [...raiz.childNodes]) {
    const suelto = n.nodeType === 3 || (n.nodeType === 1 && !BLOQUE.test(n.tagName));
    if (!suelto) { grupo = null; continue; }
    if (!grupo) { grupo = doc.createElement('p'); raiz.insertBefore(grupo, n); }
    grupo.appendChild(n);
  }
}

const esParrafoVacio = (b) => /^(P|DIV)$/.test(b.tagName) && b.textContent.trim() === '' && !b.querySelector('table,ul,ol');

export function celdaDe(nodo, raiz) {
  let n = nodo && (nodo.nodeType === 1 ? nodo : nodo.parentElement);
  while (n && n !== raiz) { if (n.tagName === 'TD' || n.tagName === 'TH') return n; n = n.parentElement; }
  return null;
}

// Inserta una tabla después del bloque donde está el cursor (o en su lugar si ese párrafo está vacío).
export function insertarTabla(win, raiz, filas = 3, cols = 3) {
  const doc = raiz.ownerDocument;
  asegurarBloques(raiz);
  const sel = win.getSelection();
  let b = sel && sel.rangeCount && raiz.contains(sel.anchorNode) ? sel.anchorNode : raiz.lastChild;
  while (b && b.parentNode !== raiz) b = b.parentNode;
  const t = crearTabla(doc, filas, cols);
  if (!b) raiz.appendChild(t);
  else if (b !== raiz && esParrafoVacio(b)) raiz.replaceChild(t, b);
  else raiz.insertBefore(t, b.nextSibling);
  if (!t.nextSibling) raiz.appendChild(parrafoVacio(doc));
  cursorAlFinal(win, t.rows[0].cells[0]);
  return t;
}

const tablaDe = (td) => td.closest('table');
const mover = (win, td) => { if (td) cursorAlFinal(win, td); };

export function filaMas(win, td, despues = true) {
  const t = tablaDe(td), tr = td.parentElement;
  if (t.rows.length >= TABLA.maxFilas) return;
  const nueva = tr.cloneNode(false);
  for (let i = 0; i < tr.cells.length; i++) nueva.appendChild(celdaVacia(td.ownerDocument));
  tr.parentNode.insertBefore(nueva, despues ? tr.nextSibling : tr);
  mover(win, nueva.cells[Math.min(td.cellIndex, nueva.cells.length - 1)]);
}

export function colMas(win, td, despues = true) {
  const t = tablaDe(td);
  if (td.parentElement.cells.length >= TABLA.maxColumnas) return;
  const i = td.cellIndex + (despues ? 1 : 0);
  for (const tr of t.rows) tr.insertBefore(celdaVacia(td.ownerDocument), tr.cells[i] || null);
  mover(win, td.parentElement.cells[i]);
}

export function quitarTabla(win, raiz, td) {
  const t = tablaDe(td);
  const sig = t.nextElementSibling || t.previousElementSibling;
  t.remove();
  if (!raiz.firstElementChild) raiz.appendChild(parrafoVacio(raiz.ownerDocument));
  cursorAlFinal(win, sig && sig.parentNode === raiz ? sig : raiz.firstElementChild);
}

export function filaMenos(win, raiz, td) {
  const t = tablaDe(td);
  if (t.rows.length <= 1) { quitarTabla(win, raiz, td); return; }
  const tr = td.parentElement, i = td.cellIndex;
  const vecina = tr.nextElementSibling || tr.previousElementSibling;
  tr.remove();
  mover(win, vecina.cells[Math.min(i, vecina.cells.length - 1)]);
}

export function colMenos(win, raiz, td) {
  const t = tablaDe(td);
  if (td.parentElement.cells.length <= 1) { quitarTabla(win, raiz, td); return; }
  const i = td.cellIndex, fila = td.parentElement;
  for (const tr of [...t.rows]) tr.deleteCell(i);
  mover(win, fila.cells[Math.min(i, fila.cells.length - 1)]);
}

export function alternarEncabezado(td) {
  const t = tablaDe(td);
  if (t.getAttribute('data-enc') === '1') t.removeAttribute('data-enc'); else t.setAttribute('data-enc', '1');
}

// Tab / Mayús+Tab: celda siguiente o anterior; al salir de la última se agrega una fila.
export function celdaVecina(win, td, atras = false) {
  const t = tablaDe(td);
  const todas = [...t.querySelectorAll('td,th')].filter((c) => c.closest('table') === t);
  const i = todas.indexOf(td) + (atras ? -1 : 1);
  if (i < 0) return;
  if (i >= todas.length) { filaMas(win, td, true); cursorAlFinal(win, t.rows[t.rows.length - 1].cells[0]); return; }
  cursorAlFinal(win, todas[i]);
}
