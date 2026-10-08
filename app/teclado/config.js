// Repositorio único del proyecto: el sitio y el programa del teclado viven aquí.
export const REPO = 'Juliancaba20/herramientas-estudiantes-fmed';

// Las versiones del teclado se publican como Releases con etiqueta "teclado-v1.3", "teclado-v1.4", etc.
export const PREFIJO_TAG = 'teclado-v';

// Versión que se enlaza si GitHub no responde. Actualícela al publicar una versión nueva (opcional:
// la página busca sola la última publicada).
export const TAG_INICIAL = 'teclado-v1.3';

export const urlRepo = `https://github.com/${REPO}`;
export const urlArchivo = (tag, archivo) => `${urlRepo}/releases/download/${tag}/${archivo}`;
