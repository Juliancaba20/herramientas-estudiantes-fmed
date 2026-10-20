// Geometría del lienzo: cajas, impactos, manijas y redimensionado. Funciones puras.
export const MIN_TAM = 2;

export function normalizarRect(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), ancho: Math.abs(x2 - x1), alto: Math.abs(y2 - y1) };
}

export const rectsSeCruzan = (a, b) => a.x <= b.x + b.ancho && a.x + a.ancho >= b.x && a.y <= b.y + b.alto && a.y + a.alto >= b.y;

export function unirRects(rects) {
  if (!rects.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) { x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.ancho); y2 = Math.max(y2, r.y + r.alto); }
  return { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 };
}

// Por ahora solo los elementos de caja se redimensionan; trazos y símbolos se moverán pero no se estirarán.
export const esRedimensionable = (el) => el.tipo === 'figura' || el.tipo === 'imagen' || el.tipo === 'texto';

// Formas básicas (Etapa 7). Las líneas y flechas van de un extremo a otro de la caja; los «volteos»
// dicen en qué esquina empieza cada una (así se conserva la dirección aunque la caja sea siempre positiva).
export const FORMAS = ['rectangulo', 'elipse', 'triangulo', 'rombo', 'linea', 'flecha'];
export const esLinea = (el) => el.tipo === 'figura' && (el.datos.forma === 'linea' || el.datos.forma === 'flecha');

export function extremosLinea(el) {
  const v = el.datos;
  const a = { x: v.volteoX ? el.x + el.ancho : el.x, y: v.volteoY ? el.y + el.alto : el.y };
  const b = { x: v.volteoX ? el.x : el.x + el.ancho, y: v.volteoY ? el.y : el.y + el.alto };
  return [a, b];
}

export function lineaDesdeExtremos(el, a, b) {
  const r = normalizarRect(a.x, a.y, b.x, b.y);
  return { ...el, ...r, datos: { ...el.datos, volteoX: b.x < a.x, volteoY: b.y < a.y } };
}

// n: 'p1' (inicio) o 'p2' (final). Devuelve la línea con ese extremo desplazado.
export function moverExtremo(el, n, dx, dy) {
  const [a, b] = extremosLinea(el);
  return n === 'p1' ? lineaDesdeExtremos(el, { x: a.x + dx, y: a.y + dy }, b) : lineaDesdeExtremos(el, a, { x: b.x + dx, y: b.y + dy });
}

// Vértices de triángulo y rombo dentro de la caja del elemento.
export function puntosForma(el) {
  const x2 = el.x + el.ancho, y2 = el.y + el.alto, xm = el.x + el.ancho / 2, ym = el.y + el.alto / 2;
  return el.datos.forma === 'rombo' ? [[xm, el.y], [x2, ym], [xm, y2], [el.x, ym]] : [[xm, el.y], [x2, y2], [el.x, y2]];
}

export function puntoEnPoligono(pts, px, py, tol = 0) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
    if (distSegmento(px, py, xi, yi, xj, yj) <= tol) return true;
  }
  return dentro;
}

export function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ¿El punto toca el trazo? (cerca de la línea, contando su grosor y la tolerancia)
export function puntoEnTrazo(el, px, py, tol = 0) {
  const p = el.datos.puntos, r = tol + el.datos.grosor / 2;
  if (px < el.x - tol || px > el.x + el.ancho + tol || py < el.y - tol || py > el.y + el.alto + tol) return false;
  if (p.length === 1) return Math.hypot(px - p[0][0], py - p[0][1]) <= r;
  for (let i = 1; i < p.length; i++) if (distSegmento(px, py, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= r) return true;
  return false;
}

// Caja que contiene los puntos de un trazo, con la mitad del grosor de margen.
export function cajaDeTrazo(puntos, grosor) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of puntos) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
  const m = grosor / 2;
  return { x: x1 - m, y: y1 - m, ancho: x2 - x1 + grosor, alto: y2 - y1 + grosor };
}

// Quita puntos que no cambian la forma (Ramer–Douglas–Peucker, sin recursión). Conserva la presión.
export function simplificar(p, eps) {
  if (p.length < 3) return p;
  const guardar = new Uint8Array(p.length);
  guardar[0] = guardar[p.length - 1] = 1;
  const pila = [[0, p.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distSegmento(p[i][0], p[i][1], p[a][0], p[a][1], p[b][0], p[b][1]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) { guardar[idx] = 1; pila.push([a, idx], [idx, b]); }
  }
  return p.filter((_, i) => guardar[i]);
}

// Borrador de zona: quita los puntos que caen dentro del círculo y devuelve los tramos que sobreviven
// (o null si el círculo no toca el trazo). Antes interpola para que el corte sea parejo.
export function borrarZona(puntos, cx, cy, r) {
  const densos = [puntos[0]];
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    const pasos = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(r / 2, 0.5)));
    for (let k = 1; k <= pasos; k++) {
      const t = k / pasos;
      densos.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  let tocado = false, actual = [];
  const tramos = [];
  for (const q of densos) {
    if (Math.hypot(q[0] - cx, q[1] - cy) <= r) { tocado = true; if (actual.length) { tramos.push(actual); actual = []; } }
    else actual.push(q);
  }
  if (actual.length) tramos.push(actual);
  return tocado ? tramos : null;
}

export function puntoEnElemento(el, px, py, tol = 0) {
  if (el.tipo === 'trazo') return puntoEnTrazo(el, px, py, tol);
  if (esLinea(el)) { const [a, b] = extremosLinea(el); return distSegmento(px, py, a.x, a.y, b.x, b.y) <= Math.max(el.datos.grosor || 2, 2) / 2 + tol; }
  if (el.tipo === 'figura' && (el.datos.forma === 'triangulo' || el.datos.forma === 'rombo')) return puntoEnPoligono(puntosForma(el), px, py, tol);
  if (el.tipo === 'figura' && el.datos.forma === 'elipse') {
    const rx = el.ancho / 2 + tol, ry = el.alto / 2 + tol;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (px - (el.x + el.ancho / 2)) / rx, dy = (py - (el.y + el.alto / 2)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return px >= el.x - tol && px <= el.x + el.ancho + tol && py >= el.y - tol && py <= el.y + el.alto + tol;
}

export function manijas(r) {
  const xm = r.x + r.ancho / 2, ym = r.y + r.alto / 2, x2 = r.x + r.ancho, y2 = r.y + r.alto;
  // Un texto solo se ensancha: su alto lo decide el contenido.
  if (r.tipo === 'texto') return [{ n: 'e', x: x2, y: ym }, { n: 'w', x: r.x, y: ym }];
  if (esLinea(r)) { const [a, b] = extremosLinea(r); return [{ n: 'p1', x: a.x, y: a.y }, { n: 'p2', x: b.x, y: b.y }]; }
  return [
    { n: 'nw', x: r.x, y: r.y }, { n: 'n', x: xm, y: r.y }, { n: 'ne', x: x2, y: r.y }, { n: 'e', x: x2, y: ym },
    { n: 'se', x: x2, y: y2 }, { n: 's', x: xm, y: y2 }, { n: 'sw', x: r.x, y: y2 }, { n: 'w', x: r.x, y: ym },
  ];
}

export function manijaEn(r, px, py, tol) {
  const m = manijas(r).find((h) => Math.abs(h.x - px) <= tol && Math.abs(h.y - py) <= tol);
  return m ? m.n : null;
}

export const CURSOR_MANIJA = { p1: 'crosshair', p2: 'crosshair', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

// Nuevo rectángulo al arrastrar una manija (dx, dy en unidades del mundo). Admite dar vuelta la figura.
export function redimensionar(orig, manija, dx, dy, proporcion = false) {
  let x1 = orig.x, y1 = orig.y, x2 = orig.x + orig.ancho, y2 = orig.y + orig.alto;
  if (manija.includes('w')) x1 += dx;
  if (manija.includes('e')) x2 += dx;
  if (manija.includes('n')) y1 += dy;
  if (manija.includes('s')) y2 += dy;
  if (proporcion && manija.length === 2 && orig.ancho > 0 && orig.alto > 0) {
    const r = orig.ancho / orig.alto;
    let w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    if (w / orig.ancho >= h / orig.alto) h = w / r; else w = h * r;
    const ax = manija.includes('w') ? orig.x + orig.ancho : orig.x;
    const ay = manija.includes('n') ? orig.y + orig.alto : orig.y;
    x1 = ax; y1 = ay;
    x2 = ax + (manija.includes('w') ? -w : w);
    y2 = ay + (manija.includes('n') ? -h : h);
  }
  const r = normalizarRect(x1, y1, x2, y2);
  return { ...r, ancho: Math.max(r.ancho, MIN_TAM), alto: Math.max(r.alto, MIN_TAM) };
}

export function trasladar(el, dx, dy) {
  if (el.tipo === 'trazo') {
    return { ...el, x: el.x + dx, y: el.y + dy, datos: { ...el.datos, puntos: el.datos.puntos.map(([x, y, p]) => [x + dx, y + dy, p]) } };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}
