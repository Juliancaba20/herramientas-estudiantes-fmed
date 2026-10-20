// Cámara del lienzo. (x, y) es el punto del mundo que está en la esquina superior izquierda
// de la pantalla; zoom es la escala (1 = tamaño real). Funciones puras, sin dibujo.

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 10;

export const camaraInicial = () => ({ x: -40, y: -40, zoom: 1 });
export const limitarZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export const pantallaAMundo = (c, px, py) => ({ x: c.x + px / c.zoom, y: c.y + py / c.zoom });
export const mundoAPantalla = (c, wx, wy) => ({ x: (wx - c.x) * c.zoom, y: (wy - c.y) * c.zoom });

// Mueve la vista para que el contenido siga al dedo o al mouse (dx, dy en píxeles de pantalla).
export const mover = (c, dx, dy) => ({ ...c, x: c.x - dx / c.zoom, y: c.y - dy / c.zoom });

// Cambia el zoom dejando fijo el punto de pantalla (px, py): lo que está bajo el cursor no se corre.
export function zoomEn(c, px, py, factor) {
  const zoom = limitarZoom(c.zoom * factor);
  const w = pantallaAMundo(c, px, py);
  return { x: w.x - px / zoom, y: w.y - py / zoom, zoom };
}

export const visibleEnMundo = (c, ancho, alto) => ({ x: c.x, y: c.y, ancho: ancho / c.zoom, alto: alto / c.zoom });

// Cámara que muestra un rectángulo del mundo completo, con margen.
export function encuadrar(rect, ancho, alto, margen = 60, zoomMaximo = 2) {
  const zoom = limitarZoom(Math.min(zoomMaximo, Math.max(1, ancho - 2 * margen) / Math.max(rect.ancho, 1), Math.max(1, alto - 2 * margen) / Math.max(rect.alto, 1)));
  return { x: rect.x + rect.ancho / 2 - ancho / 2 / zoom, y: rect.y + rect.alto / 2 - alto / 2 / zoom, zoom };
}
