// Programa de Anotomía (Windows, Mac, Linux y Android) y decisión de qué se ofrece a cada dispositivo.
// Sin React y con el navegador inyectado, para poder probarlo.
//
// Regla: cada sistema que admite el programa recibe SOLO su descarga nativa
//   Windows → .exe · Mac → .dmg · Linux → .AppImage · Android → .apk
// y el resto (iPad, iPhone, Chromebook, Windows antiguo o de 32 bits…) recibe la instalación de la versión web (PWA).

// La web (app/notas/Descargas.js) importa este mismo archivo: así el repositorio, los nombres de archivo y la
// regla de qué sistema recibe qué son los mismos en la app y en la página, y no pueden separarse.
export const REPO = 'Juliancaba20/herramientas-estudiantes-fmed';
// Publicación fija que el flujo de compilación mantiene al día en cada versión nueva (.github/workflows/compilar-notas.yml).
// Al ser siempre la misma dirección, el enlace nunca depende de la etiqueta ni se cruza con las versiones del Teclado.
export const ETIQUETA_ULTIMA = 'notas-ultima';

// Lo que se descarga en cada sistema. «nombre» es como se llama el sistema en los textos.
export const PROGRAMAS = {
  windows: { nombre: 'Windows', archivo: 'Anotomia-Windows.exe', tipo: '.exe' },
  mac: { nombre: 'Mac', archivo: 'Anotomia-Mac.dmg', tipo: '.dmg' },
  linux: { nombre: 'Linux', archivo: 'Anotomia-Linux.AppImage', tipo: '.AppImage' },
  android: { nombre: 'Android', archivo: 'Anotomia-Android.apk', tipo: '.apk' },
};
// Archivo que usa el actualizador automático del programa de escritorio
export const ARCHIVO_ACTUALIZACIONES = 'latest.json';

export const urlDescarga = (plataforma) => `https://github.com/${REPO}/releases/download/${ETIQUETA_ULTIMA}/${PROGRAMAS[plataforma].archivo}`;
export const urlActualizaciones = `https://github.com/${REPO}/releases/download/${ETIQUETA_ULTIMA}/${ARCHIVO_ACTUALIZACIONES}`;
export const urlApiUltima = `https://api.github.com/repos/${REPO}/releases/tags/${ETIQUETA_ULTIMA}`;

// ¿Se está ejecutando dentro del programa (Tauri) y no en un navegador?
export function esProgramaEscritorio(win = globalThis.window) {
  if (!win) return false;
  return !!(win.isTauri || win.__TAURI_INTERNALS__ || win.__TAURI__);
}

// ¿Es el programa de una computadora (Windows, Mac o Linux)? Solo allí hay archivos reales en el disco,
// actualización automática y apertura con doble clic. El programa de Android guarda dentro de su almacenamiento.
export function esProgramaDeComputadora(win = globalThis.window, nav = globalThis.navigator) {
  return esProgramaEscritorio(win) && detectarSistema(nav) !== 'android';
}

// Sistema del dispositivo según el navegador: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'otro' | null.
export function detectarSistema(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '');
  const tactil = (nav?.maxTouchPoints || 0) > 1;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (tactil && /Macintosh|Mac OS X/i.test(ua))) return 'ios'; // iPad con «sitio de escritorio»
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/CrOS/i.test(ua)) return 'otro'; // Chromebook: no es Linux de escritorio ni admite estos programas
  if (/Linux|X11/i.test(ua)) return 'linux';
  return null;
}

// ¿Qué programa admite este equipo? Devuelve 'windows' | 'mac' | 'linux' | 'android' o null si ninguno.
//  · Windows: 10 u 11 de 64 bits (el programa necesita WebView2, que no existe para Windows 7, 8 y 8.1;
//    en Windows con ARM funciona por emulación).
//  · Mac: el programa sirve para chip Apple y para Intel.
//  · Linux: solo de 64 bits para computadoras comunes (x86_64); Linux con ARM queda con la versión web.
//  · Android: el programa es de 64 bits (prácticamente todos los celulares y tablets actuales).
export function programaQueAdmite(nav = globalThis.navigator) {
  const sistema = detectarSistema(nav);
  const ua = String(nav?.userAgent || '');
  if (sistema === 'windows') {
    const version = ua.match(/Windows NT (\d+)(?:\.(\d+))?/i);
    if (!version || Number(version[1]) < 10) return null;
    return /Win64|WOW64|x64|ARM64|x86_64/i.test(ua) ? 'windows' : null;
  }
  if (sistema === 'mac') return 'mac';
  if (sistema === 'linux') return /x86_64|amd64|x64/i.test(ua) ? 'linux' : null;
  if (sistema === 'android') return 'android';
  return null;
}

// Compatibilidad con el nombre anterior: ¿puede este equipo ejecutar el .exe?
export const admiteProgramaWindows = (nav = globalThis.navigator) => programaQueAdmite(nav) === 'windows';

// Qué se le ofrece a este dispositivo:
//  · { tipo: 'programa', plataforma } → descargar el programa de su sistema
//  · { tipo: 'web' } → instalar la versión web
//  · { tipo: 'instalado' } → ya está dentro del programa: no hay nada que descargar
export function ofertaDeInstalacion({ nav = globalThis.navigator, win = globalThis.window } = {}) {
  if (esProgramaEscritorio(win)) return { tipo: 'instalado' };
  const plataforma = programaQueAdmite(nav);
  return plataforma ? { tipo: 'programa', plataforma } : { tipo: 'web' };
}

// Consulta qué hay publicado. Devuelve { estado, version, archivos }:
//  estado 'publicado' (hay publicación, o no se pudo consultar: el enlace igual funciona),
//         'sin-publicar' (todavía no se publicó ninguna versión).
export async function consultarPublicacion(buscar = globalThis.fetch?.bind(globalThis), { esperaMs = 6000 } = {}) {
  if (!buscar) return { estado: 'publicado', version: null, archivos: null };
  const control = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const temporizador = control ? setTimeout(() => control.abort(), esperaMs) : null;
  try {
    const r = await buscar(urlApiUltima, { headers: { Accept: 'application/vnd.github+json' }, signal: control?.signal });
    if (r.status === 404) return { estado: 'sin-publicar', version: null, archivos: [] };
    if (!r.ok) return { estado: 'publicado', version: null, archivos: null }; // límite de GitHub u otro fallo: se muestra el enlace
    const pub = await r.json();
    const m = String(pub.name || '').match(/versi[oó]n\s+(\d+(?:\.\d+)*)/i);
    return { estado: 'publicado', version: m ? m[1] : null, archivos: (pub.assets || []).map((a) => a.name) };
  } catch {
    return { estado: 'publicado', version: null, archivos: null }; // sin conexión
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

// ¿Está publicado el programa de esa plataforma? (si no se pudo consultar, se asume que sí)
export const hayProgramaPublicado = (pub, plataforma) =>
  pub.archivos === null || pub.archivos.includes(PROGRAMAS[plataforma].archivo);
