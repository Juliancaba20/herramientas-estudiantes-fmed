// Formas básicas que ofrece el pizarrón (nombre interno, texto del botón, trazo del ícono).
export const LISTA_FORMAS = [
  ['rectangulo', 'Rectángulo (R)', 'M4 6h16v12H4z'],
  ['elipse', 'Elipse (E)', 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z'],
  ['triangulo', 'Triángulo', 'M12 5l8 14H4z'],
  ['rombo', 'Rombo', 'M12 4l8 8-8 8-8-8z'],
  ['linea', 'Línea (L)', 'M5 19L19 5'],
  ['flecha', 'Flecha (A)', 'M5 19L19 5M10 5h9v9'],
];
export const ICONOS_FORMA = Object.fromEntries(LISTA_FORMAS.map(([k, , d]) => [k, d]));
export const NOMBRES_FORMA = Object.fromEntries(LISTA_FORMAS.map(([k, n]) => [k, n]));
export const ES_FORMA = (h) => h in ICONOS_FORMA;
