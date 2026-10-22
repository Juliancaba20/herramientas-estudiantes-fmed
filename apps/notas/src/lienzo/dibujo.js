import { visibleEnMundo } from './camara.js';
import { pintarTexto } from '../herramientas/texto/pintar.js';
import { FUENTE_TEXTO } from '../herramientas/texto/estilo.js';
import { esLinea, extremosLinea, manijas, puntosForma, rectsSeCruzan } from './geometria.js';
import { dibujarRenglones } from './renglones.js';
import { imagenEnCache } from '../herramientas/imagenes/recursos.js';

const AZUL = '#2350d8';

const ancho = (g, p) => g * (0.35 + 1.3 * p); // la presión 0,5 da el grosor elegido

// Trazo suavizado con curvas por los puntos medios. Con lápiz sensible a la presión (variable)
// cada tramo lleva su propio grosor; en los demás casos es una sola línea (sin manchas al ser translúcida).
export function dibujarTrazo(ctx, d, zoom = 1) {
  const p = d.puntos;
  if (!p.length) return;
  ctx.globalAlpha = d.opacidad ?? 1;
  ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (zoom < 0.5 && p.length > 6) {
    // Vista alejada: se salta parte de los puntos y se une con rectas (a esa escala no se nota y cuesta mucho menos).
    const paso = Math.max(1, Math.floor(0.6 / zoom));
    ctx.lineWidth = d.grosor;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = paso; i < p.length - 1; i += paso) ctx.lineTo(p[i][0], p[i][1]);
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0], p[0][1], (d.variable ? ancho(d.grosor, p[0][2]) : d.grosor) / 2, 0, Math.PI * 2); ctx.fill();
  } else if (p.length === 2) {
    ctx.lineWidth = d.variable ? ancho(d.grosor, (p[0][2] + p[1][2]) / 2) : d.grosor;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.stroke();
  } else if (!d.variable) {
    ctx.lineWidth = d.grosor;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    ctx.stroke();
  } else {
    const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (let i = 0; i < p.length - 1; i++) {
      const ini = i === 0 ? p[0] : medio(p[i - 1], p[i]);
      const fin = i === p.length - 2 ? p[p.length - 1] : medio(p[i], p[i + 1]);
      ctx.lineWidth = ancho(d.grosor, p[i][2]);
      ctx.beginPath(); ctx.moveTo(ini[0], ini[1]);
      if (i === 0 || i === p.length - 2) ctx.lineTo(fin[0], fin[1]); else ctx.quadraticCurveTo(p[i][0], p[i][1], fin[0], fin[1]);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// Línea o flecha (la punta va en el extremo final).
function dibujarLinea(ctx, el) {
  const d = el.datos, [a, b] = extremosLinea(el);
  const g = d.grosor > 0 ? d.grosor : 2;
  ctx.strokeStyle = d.borde || '#14192b'; ctx.lineWidth = g; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  if (d.forma === 'flecha') {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), largo = Math.min(Math.max(12, g * 4), Math.hypot(b.x - a.x, b.y - a.y) * 0.6 + 6);
    for (const s of [-1, 1]) { ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - largo * Math.cos(ang + s * 0.5), b.y - largo * Math.sin(ang + s * 0.5)); }
  }
  ctx.stroke();
}

export function recorteImagenSeguro(recorte = {}) {
  const x = Math.max(0, Math.min(0.99, Number.isFinite(recorte.x) ? recorte.x : 0));
  const y = Math.max(0, Math.min(0.99, Number.isFinite(recorte.y) ? recorte.y : 0));
  const ancho = Math.max(0.01, Math.min(1 - x, Number.isFinite(recorte.ancho) ? recorte.ancho : 1));
  const alto = Math.max(0.01, Math.min(1 - y, Number.isFinite(recorte.alto) ? recorte.alto : 1));
  return { x, y, ancho, alto };
}

export function pintarImagen(ctx, el, imagen) {
  if (!imagen) {
    ctx.fillStyle = '#e8eefc'; ctx.fillRect(el.x, el.y, el.ancho, el.alto);
    ctx.strokeStyle = '#b9c7e4'; ctx.lineWidth = 1; ctx.strokeRect(el.x, el.y, el.ancho, el.alto);
    return;
  }
  const recorte = recorteImagenSeguro(el.datos.recorte);
  const iw = imagen.naturalWidth || imagen.width, ih = imagen.naturalHeight || imagen.height;
  ctx.drawImage(imagen, recorte.x * iw, recorte.y * ih, recorte.ancho * iw, recorte.alto * ih, el.x, el.y, el.ancho, el.alto);
}

function dibujarElemento(ctx, el, zoom = 1, guiaTexto = null, alImagenLista = null) {
  const d = el.datos;
  ctx.globalAlpha = 1;
  if (el.tipo === 'figura') {
    if (esLinea(el)) { dibujarLinea(ctx, el); return; }
    ctx.beginPath();
    if (d.forma === 'elipse') ctx.ellipse(el.x + el.ancho / 2, el.y + el.alto / 2, el.ancho / 2, el.alto / 2, 0, 0, Math.PI * 2);
    else if (d.forma === 'triangulo' || d.forma === 'rombo') {
      const pts = puntosForma(el);
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    } else ctx.rect(el.x, el.y, el.ancho, el.alto);
    if (d.relleno) { ctx.fillStyle = d.relleno; ctx.fill(); }
    if (d.borde && d.grosor > 0) { ctx.lineWidth = d.grosor; ctx.strokeStyle = d.borde; ctx.lineJoin = 'round'; ctx.stroke(); }
  } else if (el.tipo === 'trazo') {
    dibujarTrazo(ctx, d, zoom);
  } else if (el.tipo === 'texto' && Array.isArray(d.bloques)) {
    pintarTexto(ctx, el, guiaTexto); // texto enriquecido (Etapa 6)
  } else if (el.tipo === 'texto' || el.tipo === 'simbolo') {
    const tam = d.tamano || 18;
    ctx.fillStyle = d.color || '#14192b';
    ctx.font = `${tam}px ${FUENTE_TEXTO}`;
    ctx.textBaseline = 'top';
    (el.tipo === 'simbolo' ? [d.caracter] : String(d.contenido || '').split('\n')).forEach((linea, i) => ctx.fillText(linea, el.x, el.y + i * tam * 1.3));
  } else if (el.tipo === 'imagen') {
    pintarImagen(ctx, el, imagenEnCache(d.blobId, ctx.canvas, alImagenLista));
  }
}

// Dibuja un cuadro completo. Solo se dibujan los elementos que cruzan la parte visible.
export function dibujar(ctx, opciones) {
  const { camara, ancho: an, alto: al, dpr, lista, escena, seleccion, marco, mostrarManijas, trazoActivo, fondoCache, borrador, ocultoId = null, renglones = null, guiaTexto = null, marcoDocumento = null, dibujadosPrevio = 0, alImagenLista = null } = opciones;
  const ancho = an, alto = al;
  if (fondoCache) {
    // Mientras se escribe: la escena ya dibujada se reutiliza y solo se redibuja el trazo en curso.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fondoCache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (trazoActivo) {
      ctx.save(); ctx.scale(camara.zoom, camara.zoom); ctx.translate(-camara.x, -camara.y);
      dibujarTrazo(ctx, trazoActivo);
      ctx.restore();
    }
    return { dibujados: dibujadosPrevio };
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const listaMarcos = Array.isArray(marcoDocumento)
    ? marcoDocumento
    : (marcoDocumento ? [marcoDocumento] : null);

  if (listaMarcos && listaMarcos.length) {
    // Mesa de trabajo alrededor de las hojas o fichas
    ctx.fillStyle = '#e8ecf4';
    ctx.fillRect(0, 0, ancho, alto);

    for (const m of listaMarcos) {
      const mx = (m.x - camara.x) * camara.zoom;
      const my = (m.y - camara.y) * camara.zoom;
      const mw = m.ancho * camara.zoom;
      const mh = m.alto * camara.zoom;
      // Solo dibujar marcos visibles en la vista actual
      if (mx + mw < 0 || mx > ancho || my + mh < 0 || my > alto) continue;

      ctx.save();
      ctx.shadowColor = 'rgba(20, 25, 43, 0.16)';
      ctx.shadowBlur = 18 * Math.min(2, Math.max(0.5, camara.zoom));
      ctx.shadowOffsetY = 4 * Math.min(2, Math.max(0.5, camara.zoom));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx, my, mw, mh);
      ctx.restore();

      ctx.strokeStyle = '#c5ceea';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, mw, mh);

      if (m.encabezadoTexto) {
        ctx.fillStyle = '#6b7280';
        ctx.font = `${Math.max(10, Math.round(12 * camara.zoom))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(m.encabezadoTexto, mx + mw / 2, my + Math.max(14, 22 * camara.zoom));
      }

      const textoPie = m.pieTexto || (m.mostrarNumero ? `Página ${m.numero}` : '');
      if (textoPie) {
        ctx.fillStyle = '#868e96';
        ctx.font = `${Math.max(10, Math.round(12 * camara.zoom))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(textoPie, mx + mw / 2, my + mh - Math.max(10, 14 * camara.zoom));
      }
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
  }

  // Renglones: capa de fondo, debajo de todo y sin relación con los elementos (Etapa 8).
  if (renglones) dibujarRenglones(ctx, renglones.cfg, camara, ancho, alto, renglones.opacidad, marcoDocumento);
  const vista = visibleEnMundo(camara, ancho, alto);

  const margen = 12 / camara.zoom;
  const zona = { x: vista.x - margen, y: vista.y - margen, ancho: vista.ancho + 2 * margen, alto: vista.alto + 2 * margen };
  let dibujados = 0;
  ctx.save();
  ctx.scale(camara.zoom, camara.zoom);
  ctx.translate(-camara.x, -camara.y);
  const diminuto = 0.5 / camara.zoom; // un trazo más chico que medio píxel no se ve: no se dibuja
  for (const el of lista) {
    if (el.id === ocultoId || !rectsSeCruzan(el, zona)) continue; // el texto que se está editando lo muestra el editor
    if (el.tipo === 'trazo' && el.ancho < diminuto && el.alto < diminuto) continue;
    dibujarElemento(ctx, el, camara.zoom, guiaTexto, alImagenLista ? (canvas) => alImagenLista(canvas, opciones) : null);
    dibujados++;
  }
  if (trazoActivo) dibujarTrazo(ctx, trazoActivo);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Selección, manijas y marco, en píxeles de pantalla para que no cambien de grosor con el zoom.
  ctx.lineWidth = 1.5; ctx.strokeStyle = AZUL;
  for (const id of seleccion) {
    const el = escena.get(id);
    if (!el) continue;
    const x = (el.x - camara.x) * camara.zoom - 3, y = (el.y - camara.y) * camara.zoom - 3;
    const w = el.ancho * camara.zoom + 6, h = el.alto * camara.zoom + 6;
    if (x > ancho || y > alto || x + w < 0 || y + h < 0) continue;
    ctx.strokeRect(x, y, w, h);
  }
  if (mostrarManijas) {
    ctx.fillStyle = '#fff';
    for (const m of manijas(mostrarManijas)) {
      const x = (m.x - camara.x) * camara.zoom, y = (m.y - camara.y) * camara.zoom;
      ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10);
    }
  }
  if (marco) {
    const x = (marco.x - camara.x) * camara.zoom, y = (marco.y - camara.y) * camara.zoom;
    ctx.fillStyle = 'rgba(35,80,216,0.08)'; ctx.fillRect(x, y, marco.ancho * camara.zoom, marco.alto * camara.zoom);
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeRect(x, y, marco.ancho * camara.zoom, marco.alto * camara.zoom); ctx.setLineDash([]);
  }
  if (borrador) {
    ctx.beginPath(); ctx.arc(borrador.x, borrador.y, borrador.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,25,43,0.05)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,25,43,0.55)'; ctx.stroke();
  }
  return { dibujados };
}
