// Renglones (Etapa 8): la guía de fondo del documento (rayado, cuadriculado, puntos o liso).
// Es una capa independiente: se dibuja debajo de todo, en el espacio del mundo, y no toca ningún elemento.
// Este módulo es común a todos los formatos: pizarrón, tarjetas y páginas A4 lo reutilizan.
import { RENGLONES_POR_DEFECTO } from '../almacen/modelo.js';

export const ESTILOS_RENGLONES = ['rayado', 'cuadriculado', 'puntos', 'liso'];
export const MODOS_RENGLONES = ['siempre', 'breve', 'ocultos'];
const HEX = /^#[0-9a-f]{6}$/i;
const acotar = (v, a, b) => Math.max(a, Math.min(b, v));

// Acepta lo que venga del documento (incluso de versiones anteriores) y devuelve una configuración completa y válida.
export function normalizarRenglones(r = {}) {
  const d = RENGLONES_POR_DEFECTO;
  return {
    estilo: ESTILOS_RENGLONES.includes(r.estilo) ? r.estilo : d.estilo,
    activos: r.activos === undefined ? d.activos : !!r.activos,
    modo: MODOS_RENGLONES.includes(r.modo) ? r.modo : d.modo,
    duracion: r.duracion === 1 ? 1 : 2,
    interlineado: acotar(Math.round(+r.interlineado || d.interlineado), 12, 160),
    color: HEX.test(r.color) ? r.color.toLowerCase() : d.color,
    intensidad: acotar(+r.intensidad || d.intensidad, 0.05, 1),
    alinear: !!r.alinear,
  };
}

const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

// ¿Hay guía que seguir? (para alinear lo nuevo)
export const guiaActiva = (cfg) => !!cfg && cfg.activos && cfg.alinear && cfg.estilo !== 'liso';

// Cuánto se ve la guía en este instante (0 a 1). `destello` = { inicio (ms), duracion (s) } cuando
// hay una aparición en curso. Con «siempre» no hay animación; con «breve» u «ocultos» solo se ve durante el destello.
export function opacidadRenglones(cfg, ahora, destello) {
  if (!cfg.activos || cfg.estilo === 'liso') return 0;
  if (cfg.modo === 'siempre') return 1;
  if (!destello) return 0;
  const t = (ahora - destello.inicio) / 1000;
  const entrada = 0.2, salida = 0.5;
  if (t < 0) return 0;
  if (t < entrada) return t / entrada;
  if (t < destello.duracion) return 1;
  if (t < destello.duracion + salida) return 1 - (t - destello.duracion) / salida;
  return 0;
}

export const destelloVigente = (destello, ahora) => !!destello && (ahora - destello.inicio) / 1000 < destello.duracion + 0.5;

// Dibuja la guía en el espacio de pantalla (el contexto ya trae la escala del dispositivo).
// Si los renglones quedan demasiado juntos al alejar la vista, se desvanecen para no formar una mancha.
export function dibujarRenglones(ctx, cfg, camara, ancho, alto, opacidad = 1, marcoDocumento = null) {
  if (opacidad <= 0 || cfg.estilo === 'liso') return;
  const z = camara.zoom, paso = cfg.interlineado * z;
  const minimo = cfg.estilo === 'puntos' ? 9 : 5;
  const visible = acotar((paso - minimo) / 6, 0, 1) * opacidad;
  if (visible <= 0) return;
  const base = cfg.estilo === 'rayado' ? 0.85 : cfg.estilo === 'cuadriculado' ? 0.6 : 1;
  const color = rgba(cfg.color, +(cfg.intensidad * base * visible).toFixed(3));
  const x0 = Math.floor(camara.x / cfg.interlineado), x1 = Math.ceil((camara.x + ancho / z) / cfg.interlineado);
  const y0 = Math.floor(camara.y / cfg.interlineado), y1 = Math.ceil((camara.y + alto / z) / cfg.interlineado);
  const sx = (i) => Math.round((i * cfg.interlineado - camara.x) * z) + 0.5;
  const sy = (j) => Math.round((j * cfg.interlineado - camara.y) * z) + 0.5;
  const listaMarcos = Array.isArray(marcoDocumento)
    ? marcoDocumento
    : (marcoDocumento ? [marcoDocumento] : null);

  ctx.save();
  if (listaMarcos && listaMarcos.length) {
    ctx.beginPath();
    for (const m of listaMarcos) {
      const mx = (m.x - camara.x) * z;
      const my = (m.y - camara.y) * z;
      const mw = m.ancho * z;
      const mh = m.alto * z;
      ctx.rect(mx, my, mw, mh);
    }
    ctx.clip();
  }
  if (cfg.estilo === 'puntos') {
    ctx.fillStyle = color;
    const r = acotar(z * 1.6, 0.9, 2.2);
    ctx.beginPath();
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) ctx.rect(sx(i) - r, sy(j) - r, 2 * r, 2 * r);
    ctx.fill();
  } else {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let j = y0; j <= y1; j++) { ctx.moveTo(0, sy(j)); ctx.lineTo(ancho, sy(j)); }
    if (cfg.estilo === 'cuadriculado') for (let i = x0; i <= x1; i++) { ctx.moveTo(sx(i), 0); ctx.lineTo(sx(i), alto); }
    ctx.stroke();
  }
  ctx.restore();
}

// Acomoda un punto del mundo a la guía: en el rayado solo en vertical (sobre un renglón);
// en cuadriculado y puntos, a la intersección más cercana. Sin guía activa devuelve el mismo punto.
export function alinearPunto(cfg, p) {
  if (!guiaActiva(cfg)) return p;
  const I = cfg.interlineado, y = Math.round(p.y / I) * I;
  return cfg.estilo === 'rayado' ? { x: p.x, y } : { x: Math.round(p.x / I) * I, y };
}
