// Conversión entre HTML y el modelo de texto (Etapa 6).
//  · domAModelo / htmlAModelo: leen lo que hay en el editor o en el portapapeles (Word, web, Google Docs…).
//    Solo se conserva lo que el modelo conoce; nada del HTML original se copia tal cual.
//  · modeloAHtml: genera el HTML del editor y del portapapeles, siempre escapado.
import { NIVEL_MAX, TABLA } from './estilo.js';
import { colorSeguro, crearRun, normalizarBloques, sanear, unirRuns } from './modelo.js';

const NOMBRES = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080', gray: '#808080', grey: '#808080', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', lime: '#00ff00', pink: '#ffc0cb', brown: '#a52a2a', navy: '#000080', teal: '#008080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000', darkblue: '#00008b', darkred: '#8b0000', darkgreen: '#006400', lightgray: '#d3d3d3', lightgrey: '#d3d3d3' };
const h2 = (n) => Math.max(0, Math.min(255, Math.round(+n))).toString(16).padStart(2, '0');

// Cualquier color CSS razonable → '#rrggbb' (o null si es transparente o desconocido).
export function colorAHex(valor) {
  if (!valor) return null;
  const v = String(valor).trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'inherit' || v === 'initial' || v === 'windowtext') return null;
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return `#${[...m[1]].map((c) => c + c).join('')}`;
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) return m[2] === '00' ? null : `#${m[1]}`;
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return `#${h2(m[1])}${h2(m[2])}${h2(m[3])}`;
  }
  return NOMBRES[v] || null;
}

const BLOQUES_HTML = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'DL', 'DT', 'DD', 'FORM', 'FIELDSET', 'CENTER']);
const ESTRUCTURA = new Set([...BLOQUES_HTML, 'UL', 'OL', 'TABLE']);
const IGNORADOS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'IMG', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'O:P', 'HR']);

const estiloAttr = (el) => (el.getAttribute && el.getAttribute('style')) || '';

function formatoDe(el, base, op) {
  const t = el.tagName.toUpperCase();
  const f = { ...base };
  if (t === 'B' || t === 'STRONG') f.negrita = true;
  else if (t === 'I' || t === 'EM' || t === 'CITE' || t === 'VAR') f.cursiva = true;
  else if (t === 'U' || t === 'INS') f.subrayado = true;
  else if (t === 'S' || t === 'STRIKE' || t === 'DEL') f.tachado = true;
  else if (t === 'FONT') { const c = colorAHex(el.getAttribute('color')); if (c) f.color = c; }
  const s = el.style;
  if (s) {
    const w = String(s.fontWeight || '').trim();
    if (w) f.negrita = /^(bold|bolder|[6-9]00)$/.test(w);
    const fs = String(s.fontStyle || '').trim();
    if (fs) f.cursiva = /^(italic|oblique)/.test(fs);
    const d = String(s.textDecorationLine || s.textDecoration || '');
    if (d) {
      if (/underline/.test(d)) f.subrayado = true;
      if (/line-through/.test(d)) f.tachado = true;
      if (/^\s*none/.test(d)) { f.subrayado = false; f.tachado = false; }
    }
    const c = colorAHex(s.color);
    if (c) f.color = c;
    let bg = colorAHex(s.backgroundColor);
    if (!bg) { const m = /mso-highlight:\s*([a-z]+)/i.exec(estiloAttr(el)); if (m) bg = NOMBRES[m[1].toLowerCase()] || null; }
    if (bg && bg !== '#ffffff') f.resaltado = bg;
  }
  // El color de tinta base y el negro de una página pegada no se guardan: así el texto sigue el color del bloque.
  if (f.color && (f.color === op.colorBase || (op.colapsar && f.color === '#000000'))) delete f.color;
  return f;
}

function alinearDe(el) {
  const a = String((el.style && el.style.textAlign) || (el.getAttribute && el.getAttribute('align')) || '').toLowerCase();
  return a === 'center' ? 'centro' : a === 'right' || a === 'end' ? 'derecha' : undefined;
}

function tipoDe(t) { return t === 'H1' ? 'titulo1' : t === 'H2' ? 'titulo2' : /^H[3-6]$/.test(t) ? 'titulo3' : 'parrafo'; }

// Listas de Word: <p style="mso-list:l0 level2 lfo1"> con una marca dentro de un span «mso-list:Ignore».
function listaMso(el) {
  const m = /mso-list:\s*([^;]+)/i.exec(estiloAttr(el));
  if (!m || /^\s*(none|ignore)/i.test(m[1])) return null;
  const nivel = Math.max(0, Math.min(NIVEL_MAX, (+(/level(\d+)/i.exec(m[1]) || [0, 1])[1] || 1) - 1));
  const marca = [...el.querySelectorAll('span')].find((s) => /mso-list:\s*ignore/i.test(estiloAttr(s)));
  const txt = marca ? marca.textContent.trim() : '';
  return { tipo: /^(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]/.test(txt) ? 'numero' : 'vineta', nivel };
}

class Constructor {
  constructor(colapsar) { this.colapsar = colapsar; this.bloques = []; this.actual = null; this.pre = 0; }

  abrir(tipo, extra = {}) { this.cerrar(); this.actual = { tipo, ...extra, runs: [], explicito: true }; }

  cerrar() {
    const b = this.actual;
    this.actual = null;
    if (!b) return;
    this._terminar(b);
    if (b.explicito || b.runs.some((r) => r.texto.trim() !== '')) {
      const { explicito, ...limpio } = b; void explicito;
      if (limpio.alinear === undefined) delete limpio.alinear;
      if (limpio.nivel === undefined) delete limpio.nivel;
      this.bloques.push(limpio);
    }
  }

  texto(str, fmt) {
    if (!str) return;
    if (!this.actual) this.actual = { tipo: 'parrafo', runs: [], explicito: false };
    let s = str.replace(/\u200b/g, '');
    if (this.colapsar && !this.pre) s = s.replace(/[ \t\r\n\f]+/g, ' ').replace(/\u00a0/g, '\uE000');
    else s = s.replace(/\u00a0/g, ' ');
    this.actual.runs.push(crearRun(s, fmt));
  }

  salto(fmt) {
    if (!this.actual) this.actual = { tipo: 'parrafo', runs: [], explicito: false };
    this.actual.runs.push(crearRun('\n', fmt));
  }

  tabla(t) { this.cerrar(); if (t) this.bloques.push(t); }

  _terminar(b) {
    if (this.colapsar) {
      // Espacios sobrantes entre fragmentos, al principio y antes de un salto
      let prev = '\n';
      for (const r of b.runs) {
        let out = '';
        for (const ch of r.texto) {
          if (ch === ' ' && (prev === ' ' || prev === '\n')) continue;
          if (ch === '\n' && prev === ' ') out = out.replace(/ $/, '');
          out += ch; prev = ch;
        }
        r.texto = out;
      }
      const u = b.runs[b.runs.length - 1];
      if (u) u.texto = u.texto.replace(/ $/, '');
    }
    const u = b.runs[b.runs.length - 1];
    if (u) u.texto = u.texto.replace(/\n$/, ''); // el <br> final es solo el marcador de línea vacía
    b.runs.forEach((r) => { r.texto = r.texto.replace(/\uE000/g, ' '); });
    b.runs = unirRuns(b.runs);
  }
}

const tieneHijosBloque = (el) => [...el.children].some((h) => ESTRUCTURA.has(h.tagName.toUpperCase()));

function hijos(el, fmt, c, op) { for (const h of [...el.childNodes]) recorrer(h, fmt, c, op); }

function item(li, tipo, nivel, fmt, c, op) {
  const n = Math.min(nivel, NIVEL_MAX);
  c.abrir(tipo, { nivel: n, alinear: alinearDe(li) });
  const f = formatoDe(li, fmt, op);
  for (const h of [...li.childNodes]) {
    const t = h.nodeType === 1 ? h.tagName.toUpperCase() : '';
    if (t === 'UL' || t === 'OL') { listar(h, n + 1, f, c, op); continue; }
    if (BLOQUES_HTML.has(t)) {
      if (!c.actual) c.abrir(tipo, { nivel: n });
      else if (c.actual.runs.length) c.salto(f);
      if (c.actual && !c.actual.alinear) { const a = alinearDe(h); if (a) c.actual.alinear = a; }
      hijos(h, formatoDe(h, f, op), c, op);
      continue;
    }
    recorrer(h, f, c, op);
  }
  c.cerrar();
}

function listar(lista, nivel, fmt, c, op) {
  const tipo = lista.tagName.toUpperCase() === 'OL' ? 'numero' : 'vineta';
  c.cerrar();
  for (const h of [...lista.childNodes]) {
    if (h.nodeType !== 1) continue;
    const t = h.tagName.toUpperCase();
    if (t === 'LI') item(h, tipo, nivel, fmt, c, op);
    else if (t === 'UL' || t === 'OL') listar(h, nivel + 1, fmt, c, op);
    else recorrer(h, fmt, c, op);
  }
  c.cerrar();
}

function celda(td, op) {
  const sub = new Constructor(op.colapsar);
  hijos(td, {}, sub, op);
  sub.cerrar();
  const runs = [];
  sub.bloques.filter((b) => b.tipo !== 'tabla').forEach((b, i) => { if (i > 0) runs.push(crearRun('\n')); runs.push(...b.runs); });
  return { runs: unirRuns(runs) };
}

function tabla(el, op) {
  const trs = [...el.querySelectorAll('tr')].filter((tr) => tr.closest('table') === el).slice(0, TABLA.maxFilas);
  const filas = trs.map((tr) => {
    const fila = [];
    for (const td of [...tr.children]) {
      const t = td.tagName.toUpperCase();
      if (t !== 'TD' && t !== 'TH') continue;
      fila.push(celda(td, op));
      const span = Math.min(+td.getAttribute('colspan') || 1, TABLA.maxColumnas);
      for (let k = 1; k < span; k++) fila.push({ runs: [] });
    }
    return fila.slice(0, TABLA.maxColumnas);
  }).filter((f) => f.length);
  if (!filas.length) return null;
  const n = Math.max(...filas.map((f) => f.length));
  filas.forEach((f) => { while (f.length < n) f.push({ runs: [] }); });
  const primera = trs[0] ? [...trs[0].children].filter((x) => /^T[DH]$/i.test(x.tagName)) : [];
  const encabezado = el.getAttribute('data-enc') === '1' || (primera.length > 0 && primera.every((x) => x.tagName.toUpperCase() === 'TH'));
  return { tipo: 'tabla', encabezado, filas };
}

function recorrer(nodo, fmt, c, op) {
  if (nodo.nodeType === 3) { c.texto(nodo.nodeValue, fmt); return; }
  if (nodo.nodeType !== 1) return;
  const t = nodo.tagName.toUpperCase();
  if (IGNORADOS.has(t)) return;
  if (/mso-list:\s*ignore/i.test(estiloAttr(nodo))) return;
  if (t === 'BR') { c.salto(fmt); return; }
  if (t === 'TABLE') { c.tabla(tabla(nodo, op)); return; }
  if (t === 'UL' || t === 'OL') { listar(nodo, 0, fmt, c, op); return; }
  const f = formatoDe(nodo, fmt, op);
  if (BLOQUES_HTML.has(t)) {
    if (tieneHijosBloque(nodo)) { c.cerrar(); hijos(nodo, f, c, op); c.cerrar(); return; }
    const mso = listaMso(nodo);
    if (mso) c.abrir(mso.tipo, { nivel: mso.nivel, alinear: alinearDe(nodo) });
    else c.abrir(tipoDe(t), { alinear: alinearDe(nodo) });
    if (t === 'PRE') c.pre++;
    hijos(nodo, f, c, op);
    if (t === 'PRE') c.pre--;
    c.cerrar();
    return;
  }
  hijos(nodo, f, c, op);
}

// raiz: elemento del editor o <body> de un documento analizado. colapsar: aplicar las reglas de espacios de HTML (contenido externo).
export function domAModelo(raiz, { colapsar = false, colorBase = null } = {}) {
  const op = { colapsar, colorBase };
  const c = new Constructor(colapsar);
  hijos(raiz, {}, c, op);
  c.cerrar();
  return normalizarBloques(c.bloques);
}

export function htmlAModelo(html, opciones = {}) {
  const DP = globalThis.DOMParser || (globalThis.window && globalThis.window.DOMParser);
  if (!DP || !html) return [];
  const doc = new DP().parseFromString(String(html), 'text/html');
  return domAModelo(doc.body, { colapsar: true, ...opciones });
}

// ---------- modelo → HTML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function runsAHtml(runs) {
  return runs.map((r) => {
    const est = [];
    if (r.negrita) est.push('font-weight:700');
    if (r.cursiva) est.push('font-style:italic');
    const dec = [r.subrayado && 'underline', r.tachado && 'line-through'].filter(Boolean);
    if (dec.length) est.push(`text-decoration:${dec.join(' ')}`);
    const c = colorSeguro(r.color); if (c) est.push(`color:${c}`);
    const h = colorSeguro(r.resaltado); if (h) est.push(`background-color:${h}`);
    const t = esc(r.texto).replace(/\n/g, '<br>');
    return est.length ? `<span style="${est.join(';')}">${t}</span>` : t;
  }).join('');
}

function interiorBloque(runs) {
  const h = runsAHtml(runs);
  if (!runs.length) return '<br>';
  return runs[runs.length - 1].texto.endsWith('\n') ? `${h}<br>` : h; // marcador para conservar la última línea en blanco
}

const alineacion = (b) => (b.alinear && b.alinear !== 'izquierda' ? ` style="text-align:${b.alinear === 'centro' ? 'center' : 'right'}"` : '');

// relleno: añade un párrafo vacío tras una tabla final, para poder seguir escribiendo debajo.
export function modeloAHtml(bloques, { relleno = false } = {}) {
  const lista = sanear(bloques);
  let out = '';
  const pila = [];
  const cerrarListas = (hasta = 0) => { while (pila.length > hasta) out += `</li></${pila.pop()}>`; };
  for (const b of lista) {
    if (b.tipo === 'vineta' || b.tipo === 'numero') {
      const tag = b.tipo === 'numero' ? 'ol' : 'ul';
      const n = Math.min(b.nivel, pila.length);
      cerrarListas(n + 1);
      if (pila.length === n + 1) {
        if (pila[n] !== tag) { out += `</li></${pila.pop()}>`; } else out += '</li>';
      }
      while (pila.length < n + 1) { out += `<${tag}>`; pila.push(tag); }
      out += `<li${alineacion(b)}>${interiorBloque(b.runs)}`;
      continue;
    }
    cerrarListas();
    if (b.tipo === 'tabla') {
      out += `<table${b.encabezado ? ' data-enc="1"' : ''}><tbody>${b.filas.map((f) => `<tr>${f.map((c) => `<td>${c.runs.length ? interiorBloque(c.runs) : '<br>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      continue;
    }
    const tag = b.tipo === 'titulo1' ? 'h1' : b.tipo === 'titulo2' ? 'h2' : b.tipo === 'titulo3' ? 'h3' : 'p';
    out += `<${tag}${alineacion(b)}>${interiorBloque(b.runs)}</${tag}>`;
  }
  cerrarListas();
  if (!lista.length || (relleno && lista[lista.length - 1].tipo === 'tabla')) out += '<p><br></p>';
  return out;
}
