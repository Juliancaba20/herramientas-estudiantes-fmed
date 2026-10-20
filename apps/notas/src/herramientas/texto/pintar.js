// Dibujo del texto enriquecido en el lienzo (Etapa 6): mide con canvas, guarda la maquetación
// en caché y ejecuta las órdenes de dibujo que devuelve maquetar().
import { BLOQUES, fuente } from './estilo.js';
import { maquetar } from './maquetar.js';
import { tamanoDe } from './modelo.js';

const tamDeFuente = (f) => parseFloat(/([\d.]+)px/.exec(f)?.[1]) || 16;
let ctxMedida;
let version = 0;
const anchos = new Map();
const metricas = new Map();

function contexto() {
  if (ctxMedida !== undefined) return ctxMedida;
  try { ctxMedida = (typeof document !== 'undefined' && document.createElement('canvas').getContext('2d')) || null; } catch { ctxMedida = null; }
  return ctxMedida;
}

// Mide con el canvas real; sin canvas (pruebas) se estima, con valores estables.
export const medidorCanvas = {
  ancho(f, texto) {
    const k = `${f}|${texto}`;
    let w = anchos.get(k);
    if (w === undefined) {
      const ctx = contexto();
      let m;
      if (ctx) { ctx.font = f; m = ctx.measureText(texto); }
      w = m && typeof m.width === 'number' ? m.width : texto.length * tamDeFuente(f) * 0.55;
      if (anchos.size > 20000) anchos.clear();
      anchos.set(k, w);
    }
    return w;
  },
  metricas(f) {
    let m = metricas.get(f);
    if (!m) {
      const t = tamDeFuente(f);
      const ctx = contexto();
      let r;
      if (ctx) { ctx.font = f; r = ctx.measureText('Hg'); }
      const asc = r && Number.isFinite(r.fontBoundingBoxAscent) ? r.fontBoundingBoxAscent : t * 0.95;
      const desc = r && Number.isFinite(r.fontBoundingBoxDescent) ? r.fontBoundingBoxDescent : t * 0.25;
      m = { asc, desc };
      metricas.set(f, m);
    }
    return m;
  },
};

// Hay que llamarla cuando termina de cargar una tipografía: las medidas anteriores ya no valen.
export function invalidarMetricas() { version++; anchos.clear(); metricas.clear(); }

const cache = new WeakMap(); // datos → { ancho, version, medidor, interlineado, layout }
export function layoutDe(datos, ancho, medidor = medidorCanvas, opciones = {}) {
  const interlineado = datos.composicion === 'guiada' ? opciones.interlineado : null;
  const c = cache.get(datos);
  if (c && c.ancho === ancho && c.version === version && c.medidor === medidor && c.interlineado === interlineado) return c.layout;
  const layout = maquetar(datos, ancho, medidor, { interlineado });
  cache.set(datos, { ancho, version, medidor, interlineado, layout });
  return layout;
}

// Distancia desde el borde superior del texto hasta la línea de base de su primer renglón (para apoyarlo en un renglón del fondo).
export function baseDelPrimerRenglon(datos, ancho, opciones = {}) {
  const L = layoutDe(datos, ancho, medidorCanvas, opciones);
  if (L.textos.length) return L.textos[0].y;
  const t = tamanoDe(datos), m = medidorCanvas.metricas(fuente({}, t));
  const lh = datos.composicion === 'guiada' && opciones.interlineado > 0 ? opciones.interlineado : t * BLOQUES.parrafo.interlinea;
  return (lh - (m.asc + m.desc)) / 2 + m.asc;
}

export function pintarTexto(ctx, el, guia) {
  const L = layoutDe(el.datos, el.ancho, medidorCanvas, { interlineado: guia?.interlineado });
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.globalAlpha = 1;
  for (const f of L.fondos) { ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, f.w, f.h); }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let fa = '', ca = '';
  for (const t of L.textos) {
    if (t.fuente !== fa) { ctx.font = t.fuente; fa = t.fuente; }
    if (t.color !== ca) { ctx.fillStyle = t.color; ca = t.color; }
    ctx.fillText(t.texto, t.x, t.y);
  }
  ctx.lineCap = 'butt';
  for (const l of L.lineas) {
    ctx.strokeStyle = l.color; ctx.lineWidth = l.grosor;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
  }
  ctx.restore();
}
