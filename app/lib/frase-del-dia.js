// Utilidades compartidas por la portada (navegador) y por las rutas del servidor (historias de Instagram).
// Cada fecha del calendario tiene SIEMPRE la misma frase: se usa un año bisiesto de referencia (2000),
// así el 29 de febrero tiene la suya y el 1 de enero siempre es la primera frase del archivo.

export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const DIA_MS = 86400000;

/** Posición (0 a 365) de un día dentro del año de referencia bisiesto. */
export function indiceDelAnio(mes, dia) {
  return Math.round((Date.UTC(2000, mes - 1, dia) - Date.UTC(2000, 0, 1)) / DIA_MS);
}

export const dos = (n) => String(n).padStart(2, '0');
export const claveMD = (mes, dia) => `${dos(mes)}-${dos(dia)}`;

/** Fecha (año, mes, día) vista en una zona horaria concreta. */
export function fechaEnZona(zona = ZONA_ARGENTINA, ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return { anio: Number(v.year), mes: Number(v.month), dia: Number(v.day) };
}

/** Milisegundos que faltan para la próxima medianoche local del navegador. */
export function msHastaMedianoche(ahora = new Date()) {
  const sig = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1000, sig.getTime() - ahora.getTime());
}

/** Clasifica la frase por longitud para ajustar el tamaño de letra (web) y de la historia. */
export function nivelDeLargo(texto) {
  const n = texto.length;
  if (n <= 60) return 'corta';
  if (n <= 130) return 'media';
  if (n <= 190) return 'larga';
  return 'muy-larga';
}

/** Interpreta «MM-DD» o «AAAA-MM-DD». Devuelve null si no es una fecha válida. */
export function leerFecha(texto) {
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(texto || '');
  if (!m) return null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return null;
  const maxDia = new Date(Date.UTC(2000, mes, 0)).getUTCDate();
  if (dia > maxDia) return null;
  return { anio: m[1] ? Number(m[1]) : null, mes, dia };
}
