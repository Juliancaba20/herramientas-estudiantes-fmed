// Minimapa (Etapa 7): una vista chica de todo el pizarrón con el recuadro de lo que se ve ahora.
// Tocar o arrastrar sobre él mueve la vista. No guarda nada: se dibuja de cero en cada cuadro,
// y todo el contenido se traza con muy pocas órdenes para que no pese aunque haya miles de elementos.
import { unirRects } from './geometria.js';

// Cómo se reparte el mundo en la caja del minimapa. Siempre incluye el contenido y la vista actual.
export function geometriaMinimapa(contenido, vista, w, h, margen = 6) {
  const mundo0 = unirRects([contenido, vista].filter(Boolean)) || vista;
  const relleno = Math.max(mundo0.ancho, mundo0.alto, 1) * 0.04;
  const mundo = { x: mundo0.x - relleno, y: mundo0.y - relleno, ancho: mundo0.ancho + 2 * relleno, alto: mundo0.alto + 2 * relleno };
  const escala = Math.min((w - 2 * margen) / mundo.ancho, (h - 2 * margen) / mundo.alto);
  const ox = (w - mundo.ancho * escala) / 2 - mundo.x * escala;
  const oy = (h - mundo.alto * escala) / 2 - mundo.y * escala;
  return {
    escala,
    aMini: (x, y) => ({ x: x * escala + ox, y: y * escala + oy }),
    aMundo: (px, py) => ({ x: (px - ox) / escala, y: (py - oy) / escala }),
  };
}

export class Minimapa {
  constructor(canvas, motor) {
    this.canvas = canvas;
    this.motor = motor;
    this.ctx = canvas.getContext('2d');
    this._arrastre = null;
    this._fija = null; // mientras se arrastra, el mapa no cambia de escala para que el dedo no «huya»
    const evs = [
      ['pointerdown', (e) => this._abajo(e)],
      ['pointermove', (e) => this._mover(e)],
      ['pointerup', (e) => this._arriba(e)],
      ['pointercancel', (e) => this._arriba(e)],
    ];
    this._evs = evs;
    evs.forEach(([t, f]) => canvas.addEventListener(t, f));
  }

  destruir() { this._evs.forEach(([t, f]) => this.canvas.removeEventListener(t, f)); }

  _medidas() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) { this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); }
    return { w, h, dpr };
  }

  _geo(w, h) {
    const m = this.motor;
    return geometriaMinimapa(m.escena.limites(), { x: m.camara.x, y: m.camara.y, ancho: m.ancho / m.camara.zoom, alto: m.alto / m.camara.zoom }, w, h);
  }

  pintar() {
    const { w, h, dpr } = this._medidas();
    const ctx = this.ctx, m = this.motor;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const geo = this._fija || this._geo(w, h), k = geo.escala;
    const lista = m.escena.lista();

    // Trazos: todos juntos en un solo recorrido (de punta a punta pasando por el medio).
    ctx.strokeStyle = 'rgba(60,72,110,0.75)'; ctx.lineWidth = 1; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const el of lista) {
      if (el.tipo !== 'trazo') continue;
      const p = el.datos.puntos, a = geo.aMini(p[0][0], p[0][1]);
      ctx.moveTo(a.x, a.y);
      if (p.length > 2) { const c = p[p.length >> 1], q = geo.aMini(c[0], c[1]); ctx.lineTo(q.x, q.y); }
      const b = geo.aMini(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.lineTo(b.x + (p.length === 1 ? 0.5 : 0), b.y);
    }
    ctx.stroke();

    // Figuras, textos e imágenes: rectángulos de su caja.
    ctx.fillStyle = 'rgba(35,80,216,0.28)';
    for (const el of lista) {
      if (el.tipo === 'trazo') continue;
      const a = geo.aMini(el.x, el.y);
      ctx.fillRect(a.x, a.y, Math.max(1.5, el.ancho * k), Math.max(1.5, el.alto * k));
    }

    // Lo que se ve ahora
    const v = geo.aMini(m.camara.x, m.camara.y);
    const vw = (m.ancho / m.camara.zoom) * k, vh = (m.alto / m.camara.zoom) * k;
    ctx.fillStyle = 'rgba(35,80,216,0.10)'; ctx.fillRect(v.x, v.y, vw, vh);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#2350d8'; ctx.strokeRect(v.x, v.y, vw, vh);
  }

  // Centra la vista en el punto tocado del minimapa (sin cambiar el zoom).
  _ir(e) {
    const r = this.canvas.getBoundingClientRect();
    const { w, h } = this._medidas();
    const geo = this._fija || this._geo(w, h);
    const p = geo.aMundo(e.clientX - r.left, e.clientY - r.top);
    this.motor.irA(p.x, p.y);
  }

  _abajo(e) {
    e.preventDefault(); e.stopPropagation();
    this._arrastre = e.pointerId;
    const { w, h } = this._medidas();
    this._fija = this._geo(w, h);
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    this._ir(e);
  }

  _mover(e) { if (this._arrastre === e.pointerId) { e.preventDefault(); this._ir(e); } }

  _arriba(e) {
    if (this._arrastre !== e.pointerId) return;
    this._arrastre = null; this._fija = null;
    this.motor.pedirDibujo();
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
  }
}
