// Lógica del modo estudio de tarjetas: navegar de una tarjeta a otra sin editar.
// Se mantiene separada de la pantalla para poder probarla.

// Índice al avanzar o retroceder `paso` tarjetas. Se detiene en la primera y en la última.
export function moverEstudio(indice, paso, total) {
  if (!total || total < 1) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(indice) + Math.round(paso)));
}

// Acción de un toque o clic según la zona: tercio izquierdo retrocede, tercio derecho avanza, el centro no hace nada.
export function pasoPorToque(x, ancho) {
  if (!(ancho > 0)) return 0;
  const f = x / ancho;
  if (f < 1 / 3) return -1;
  if (f > 2 / 3) return 1;
  return 0;
}

// Acción de un deslizamiento horizontal: a la izquierda avanza, a la derecha retrocede.
// Se ignora si el movimiento es corto o más vertical que horizontal.
export function pasoPorDeslizamiento(dx, dy, minimo = 50) {
  if (Math.abs(dx) < minimo || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

// Paso que corresponde a una tecla (flechas, Re Pág, Av Pág, Inicio y Fin), o null si no es de navegación.
export function pasoPorTecla(tecla, indice, total) {
  switch (tecla) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': return moverEstudio(indice, 1, total);
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': return moverEstudio(indice, -1, total);
    case 'Home': return 0;
    case 'End': return Math.max(0, total - 1);
    default: return null;
  }
}
