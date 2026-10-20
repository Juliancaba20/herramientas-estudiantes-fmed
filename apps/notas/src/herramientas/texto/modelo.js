// Modelo del texto enriquecido (Etapa 6). Funciones puras, sin DOM.
//
// datos de un elemento 'texto':
//   { bloques: [Bloque], tamano, color }
// Bloque de texto:  { tipo: 'parrafo'|'titulo1'|'titulo2'|'titulo3'|'vineta'|'numero', alinear?, nivel?, runs: [Run] }
// Bloque de tabla:  { tipo: 'tabla', encabezado?, filas: [[{ runs: [Run] }]] }
// Run: { texto, negrita?, cursiva?, subrayado?, tachado?, color?, resaltado? }  (solo se guardan las marcas activas)
// Los textos antiguos con { contenido } se siguen leyendo (ver bloquesDe).
import { ALINEACIONES, BLOQUES, COLOR_TEXTO, NIVEL_MAX, TABLA, TAMANO_TEXTO } from './estilo.js';

const MARCAS = ['negrita', 'cursiva', 'subrayado', 'tachado'];
const HEX = /^#[0-9a-f]{6}$/i;

export const colorSeguro = (c) => (typeof c === 'string' && HEX.test(c) ? c.toLowerCase() : null);

export const crearRun = (texto, f = {}) => {
  const r = { texto };
  for (const m of MARCAS) if (f[m]) r[m] = true;
  const c = colorSeguro(f.color); if (c) r.color = c;
  const h = colorSeguro(f.resaltado); if (h) r.resaltado = h;
  return r;
};

export const mismoFormato = (a, b) => MARCAS.every((m) => !!a[m] === !!b[m]) && (a.color || '') === (b.color || '') && (a.resaltado || '') === (b.resaltado || '');

// Une fragmentos contiguos con el mismo formato y descarta los vacíos.
export function unirRuns(runs) {
  const out = [];
  for (const r of runs) {
    if (!r.texto) continue;
    const u = out[out.length - 1];
    if (u && mismoFormato(u, r)) u.texto += r.texto; else out.push({ ...r });
  }
  return out;
}

export const textoDeRuns = (runs) => runs.map((r) => r.texto).join('');
export const bloqueVacio = () => ({ tipo: 'parrafo', runs: [] });

const textoDeBloque = (b) => (b.tipo === 'tabla' ? b.filas.map((f) => f.map((c) => textoDeRuns(c.runs)).join('')).join('') : textoDeRuns(b.runs));

// ¿No hay nada escrito? (solo párrafos en blanco)
export const esVacio = (bloques) => !Array.isArray(bloques) || bloques.every((b) => b.tipo !== 'tabla' && textoDeBloque(b).trim() === '');

// Quita los párrafos en blanco del final y fusiona fragmentos.
export function normalizarBloques(bloques) {
  const out = bloques.map((b) => (b.tipo === 'tabla'
    ? { ...b, filas: b.filas.map((f) => f.map((c) => ({ runs: unirRuns(c.runs) }))) }
    : { ...b, runs: unirRuns(b.runs) }));
  while (out.length && out[out.length - 1].tipo === 'parrafo' && textoDeRuns(out[out.length - 1].runs).trim() === '' && !out[out.length - 1].alinear) out.pop();
  return out;
}

// Lee datos que pueden venir de un archivo ajeno: devuelve siempre bloques válidos.
export function sanear(bloques) {
  if (!Array.isArray(bloques)) return [];
  const runsOk = (rs) => (Array.isArray(rs) ? rs : []).filter((r) => r && typeof r.texto === 'string').map((r) => ({ ...crearRun(String(r.texto).replace(/\t/g, '    '), r) }));
  const out = [];
  for (const b of bloques) {
    if (!b || typeof b !== 'object') continue;
    if (b.tipo === 'tabla') {
      const filas = (Array.isArray(b.filas) ? b.filas : []).slice(0, TABLA.maxFilas).map((f) => (Array.isArray(f) ? f : []).slice(0, TABLA.maxColumnas).map((c) => ({ runs: runsOk(c && c.runs) })));
      const n = Math.max(1, ...filas.map((f) => f.length));
      if (!filas.length) continue;
      filas.forEach((f) => { while (f.length < n) f.push({ runs: [] }); });
      out.push({ tipo: 'tabla', encabezado: !!b.encabezado, filas });
    } else {
      const tipo = BLOQUES[b.tipo] ? b.tipo : 'parrafo';
      const nb = { tipo, runs: runsOk(b.runs) };
      if (ALINEACIONES.includes(b.alinear) && b.alinear !== 'izquierda') nb.alinear = b.alinear;
      if (BLOQUES[tipo].lista) nb.nivel = Math.max(0, Math.min(NIVEL_MAX, Math.floor(+b.nivel || 0)));
      if (tipo === 'numero' && Number.isFinite(+b.inicio) && +b.inicio > 0) nb.inicio = Math.floor(+b.inicio);
      out.push(nb);
    }
  }
  return out;
}

// Texto plano → bloques. Reconoce viñetas («- », «* », «• ») y numeración («1. », «1) »).
export function textoAModelo(texto) {
  const lineas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
  const bloques = lineas.map((l) => {
    const sangria = /^(\s*)/.exec(l)[1].replace(/\t/g, '  ').length;
    const nivel = Math.min(NIVEL_MAX, Math.floor(sangria / 2));
    let m = /^\s*[-*•·◦▪]\s+(.*)$/.exec(l);
    if (m) return { tipo: 'vineta', nivel, runs: unirRuns([crearRun(m[1])]) };
    m = /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if (m) return { tipo: 'numero', nivel, runs: unirRuns([crearRun(m[1])]) };
    return { tipo: 'parrafo', runs: unirRuns([crearRun(l.replace(/\t/g, '    '))]) };
  });
  return normalizarBloques(bloques);
}

const letras = (n) => String.fromCharCode(96 + ((n - 1) % 26) + 1);
function romano(n) {
  const t = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
// Etiqueta de numeración según el nivel: 1. / a. / i.
export const etiquetaNumero = (n, nivel) => `${nivel === 0 ? n : nivel === 1 ? letras(n) : romano(n)}.`;

// Bloques → texto plano (para copiar fuera de la app).
export function modeloATexto(bloques) {
  const cont = [];
  const lineas = [];
  for (const b of sanear(bloques)) {
    if (b.tipo === 'tabla') { cont.length = 0; b.filas.forEach((f) => lineas.push(f.map((c) => textoDeRuns(c.runs).replace(/\n/g, ' ')).join('\t'))); continue; }
    if (!BLOQUES[b.tipo].lista) { cont.length = 0; lineas.push(textoDeRuns(b.runs)); continue; }
    cont.length = b.nivel + 1;
    const sangria = '  '.repeat(b.nivel);
    if (b.tipo === 'numero') { cont[b.nivel] = (cont[b.nivel] || 0) + 1; lineas.push(`${sangria}${etiquetaNumero(cont[b.nivel], b.nivel)} ${textoDeRuns(b.runs)}`); }
    else { cont[b.nivel] = 0; lineas.push(`${sangria}• ${textoDeRuns(b.runs)}`); }
  }
  return lineas.join('\n');
}

// Datos de un texto nuevo.
export const datosTextoNuevo = (tamano = TAMANO_TEXTO) => ({ bloques: [], tamano, color: COLOR_TEXTO });

// Bloques de un elemento, incluidos los textos antiguos con { contenido }.
export function bloquesDe(datos) {
  if (datos && Array.isArray(datos.bloques)) return datos.bloques;
  const c = datos && datos.contenido;
  return typeof c === 'string' ? textoAModelo(c) : [];
}

export const tamanoDe = (datos) => (datos && datos.tamano > 0 ? datos.tamano : TAMANO_TEXTO);
export const colorBaseDe = (datos) => colorSeguro(datos && datos.color) || COLOR_TEXTO;
