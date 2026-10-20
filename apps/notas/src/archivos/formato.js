// Formato propio de archivo «.nota» (Etapa 12).
// Empaqueta y desempaqueta documentos de forma autónoma con datos, elementos e imágenes.

import { FORMATOS, MODOS_ESCRITURA, RENGLONES_POR_DEFECTO, TIPOS_ELEMENTO, nuevoId } from '../almacen/modelo.js';
import { sanear as sanearBloquesTexto } from '../herramientas/texto/modelo.js';
import { normalizarTarjetasConfig } from '../formatos/tarjetas.js';
import { normalizarPaginasConfig } from '../formatos/paginas.js';

export const ID_APP = 'anotomia';
export const VERSION_FORMATO = 1;
export const MIME_TIPO_NOTA = 'application/x-anotomia-nota';

// Convierte ArrayBuffer a Base64 en bloques seguros para no desbordar la pila de llamadas
export function arrayBufferABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binario = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binario);
}

// Convierte Base64 a Uint8Array
export function base64AUint8Array(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

// Comprime bytes con Gzip usando CompressionStream nativo si está disponible
export async function comprimirBytes(bytes) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Response(bytes).body.pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return bytes;
    }
  }
  return bytes;
}

// Descomprime bytes con Gzip si detecta los bytes mágicos 0x1F, 0x8B
export async function descomprimirBytes(bytes) {
  if (bytes && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
        const buf = await new Response(stream).arrayBuffer();
        return new Uint8Array(buf);
      } catch (e) {
        throw new Error('El archivo comprimido está dañado o no se pudo descomprimir: ' + e.message);
      }
    }
  }
  return bytes;
}

// Migraciones de esquema entre versiones del archivo .nota
export const MIGRACIONES = {
  // Futuras versiones:
  // 2: (datos) => { ... },
};

export function migrarArchivo(datos) {
  if (!datos || typeof datos !== 'object') {
    throw new Error('El archivo no contiene un formato de datos reconocible.');
  }
  if (!datos.formatoApp || String(datos.formatoApp).toLowerCase() !== ID_APP.toLowerCase()) {
    throw new Error('El archivo seleccionado no pertenece a la aplicación Anotomía.');
  }
  const version = datos.versionArchivo || 1;
  if (version > VERSION_FORMATO) {
    throw new Error(`El archivo fue creado con una versión más reciente (${version}) de Anotomía. Actualice la aplicación para poder abrirlo.`);
  }

  let actual = { ...datos };
  for (let v = version + 1; v <= VERSION_FORMATO; v++) {
    if (typeof MIGRACIONES[v] === 'function') {
      actual = MIGRACIONES[v](actual);
      actual.versionArchivo = v;
    }
  }
  return actual;
}

// Empaqueta un único documento con sus elementos y recursos en un Uint8Array (.nota)
export async function empaquetarDocumento(documento, elementos = [], recursos = []) {
  const estructura = {
    formatoApp: ID_APP,
    versionArchivo: VERSION_FORMATO,
    exportado: Date.now(),
    tipo: 'documento',
    documento,
    elementos,
    recursos,
  };
  const json = JSON.stringify(estructura);
  const bytes = new TextEncoder().encode(json);
  return comprimirBytes(bytes);
}

// Empaqueta múltiples documentos en un solo archivo de copia de respaldo
export async function empaquetarColeccion(items, carpetas = []) {
  const estructura = {
    formatoApp: ID_APP,
    versionArchivo: VERSION_FORMATO,
    exportado: Date.now(),
    tipo: 'coleccion',
    items, // cada uno: { documento, elementos, recursos }
    carpetas: Array.isArray(carpetas) ? carpetas : [],
  };
  const json = JSON.stringify(estructura);
  const bytes = new TextEncoder().encode(json);
  return comprimirBytes(bytes);
}

// Desempaqueta y valida un archivo .nota o de respaldo desde un ArrayBuffer o Uint8Array
export async function desempaquetarArchivo(entrada) {
  let bytes;
  if (typeof Blob !== 'undefined' && entrada instanceof Blob) {
    bytes = new Uint8Array(await entrada.arrayBuffer());
  } else if (entrada instanceof ArrayBuffer) {
    bytes = new Uint8Array(entrada);
  } else if (entrada instanceof Uint8Array) {
    bytes = entrada;
  } else if (entrada?.buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(entrada.buffer, entrada.byteOffset, entrada.byteLength);
  } else {
    bytes = new Uint8Array(entrada);
  }
  bytes = await descomprimirBytes(bytes);
  let texto = '';
  try {
    texto = new TextDecoder('utf-8').decode(bytes);
  } catch {
    throw new Error('El archivo no contiene texto legible ni codificación UTF-8 válida.');
  }

  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no contiene un formato JSON válido o está dañado.');
  }

  const migrado = migrarArchivo(datos);

  if (migrado.tipo === 'coleccion') {
    const itemsValidos = (Array.isArray(migrado.items) ? migrado.items : []).map((it) => sanearDocumentoImportado(it));
    const carpetasValidas = Array.isArray(migrado.carpetas)
      ? migrado.carpetas.filter((c) => c && typeof c === 'object' && c.nombre).map((c) => ({
        id: String(c.id || nuevoId()),
        nombre: String(c.nombre).slice(0, 100).trim(),
        color: String(c.color || '#2350d8'),
        creado: typeof c.creado === 'number' ? c.creado : Date.now(),
      }))
      : [];
    return {
      tipo: 'coleccion',
      items: itemsValidos,
      carpetas: carpetasValidas,
      exportado: migrado.exportado || Date.now(),
    };
  }

  // Por defecto, tipo 'documento'
  const unico = sanearDocumentoImportado(migrado);
  return {
    tipo: 'documento',
    ...unico,
    exportado: migrado.exportado || Date.now(),
  };
}


// Límites para que un archivo dañado o malicioso no pueda congelar ni romper los editores.
const MAX_PAGINAS = 500;
const MAX_TARJETAS = 500;
const COORD_MAX = 1e7;
const CLAVES_PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);

// Copia un valor JSON descartando claves peligrosas, números no finitos y estructuras demasiado profundas o grandes.
function limpiarJson(valor, profundidad = 0) {
  if (profundidad > 6) return undefined;
  if (valor === null || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === 'string') return valor.slice(0, 500);
  if (Array.isArray(valor)) {
    return valor.slice(0, 1000).map((v) => limpiarJson(v, profundidad + 1)).filter((v) => v !== undefined);
  }
  if (typeof valor === 'object') {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVES_PROHIBIDAS.has(k)) continue;
      const limpio = limpiarJson(v, profundidad + 1);
      if (limpio !== undefined) salida[k] = limpio;
    }
    return salida;
  }
  return undefined;
}

// Sanea la configuración propia de cada formato (cámara, páginas, tarjetas…) de un documento importado.
export function sanearConfigImportada(formato, configCruda) {
  const base = limpiarJson(configCruda && typeof configCruda === 'object' && !Array.isArray(configCruda) ? configCruda : {}) || {};

  const c = base.camara;
  if (c !== undefined) {
    const valida = c && typeof c === 'object' && esNumeroFinito(c.x) && esNumeroFinito(c.y)
      && esNumeroFinito(c.zoom) && c.zoom >= 0.02 && c.zoom <= 50
      && Math.abs(c.x) <= COORD_MAX && Math.abs(c.y) <= COORD_MAX;
    if (!valida) delete base.camara;
  }

  if (formato === FORMATOS.PAGINAS) {
    base.cantidadPaginas = Math.min(MAX_PAGINAS, Math.max(1, Math.round(+base.cantidadPaginas || 1)));
    return normalizarPaginasConfig(base);
  }
  if (formato === FORMATOS.TARJETAS) {
    if (Array.isArray(base.tarjetas)) {
      base.tarjetas = base.tarjetas
        .filter((t) => t && typeof t === 'object' && !Array.isArray(t))
        .slice(0, MAX_TARJETAS)
        .map((t) => ({ ...t, id: typeof t.id === 'string' && t.id.trim() ? t.id.trim().slice(0, 100) : undefined }));
    }
    return normalizarTarjetasConfig(base);
  }
  return base;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const esColorValido = (c) => typeof c === 'string' && HEX_COLOR.test(c);
const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n);

// Sanear de forma exhaustiva los datos importados (tratar todo archivo como no confiable)
export function sanearDocumentoImportado(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('Los datos del documento no tienen una estructura válida.');
  }
  const rawDoc = item.documento || item;
  if (!rawDoc || typeof rawDoc !== 'object') {
    throw new Error('No se encontraron los datos del documento en el archivo.');
  }

  // 1. Sanear Documento
  const formatosValidos = Object.values(FORMATOS);
  const formato = formatosValidos.includes(rawDoc.formato) ? rawDoc.formato : FORMATOS.PIZARRON;
  const modosEscritura = Object.values(MODOS_ESCRITURA);
  const escritura = modosEscritura.includes(rawDoc.escritura) ? rawDoc.escritura : MODOS_ESCRITURA.AMBOS;
  const tituloLimpio = String(rawDoc.titulo || 'Sin título')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 200) || 'Sin título';

  const docId = typeof rawDoc.id === 'string' && rawDoc.id.trim().length > 0 ? rawDoc.id.trim() : nuevoId();
  const creado = esNumeroFinito(rawDoc.creado) ? rawDoc.creado : Date.now();
  const modificado = esNumeroFinito(rawDoc.modificado) ? rawDoc.modificado : Date.now();

  const renglones = {
    ...RENGLONES_POR_DEFECTO,
    ...(rawDoc.renglones && typeof rawDoc.renglones === 'object' ? rawDoc.renglones : {}),
  };
  // Asegurar valores válidos en renglones
  if (!['liso', 'rayado', 'cuadriculado', 'puntos'].includes(renglones.estilo)) renglones.estilo = 'rayado';
  if (!['siempre', 'breve', 'ocultos'].includes(renglones.modo)) renglones.modo = 'siempre';
  if (!esNumeroFinito(renglones.interlineado) || renglones.interlineado < 16 || renglones.interlineado > 120) renglones.interlineado = 32;
  if (!esColorValido(renglones.color)) renglones.color = '#2350d8';
  if (!esNumeroFinito(renglones.intensidad)) renglones.intensidad = 0.35;
  renglones.intensidad = Math.max(0.05, Math.min(1, renglones.intensidad));

  const documento = {
    id: docId,
    version: 1,
    titulo: tituloLimpio,
    formato,
    creado,
    modificado,
    papelera: null,
    escritura,
    renglones,
    carpetaId: (typeof rawDoc.carpetaId === 'string' && rawDoc.carpetaId.trim()) ? rawDoc.carpetaId.trim().slice(0, 100) : null,
    etiquetas: Array.isArray(rawDoc.etiquetas)
      ? rawDoc.etiquetas.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 40)).slice(0, 30)
      : [],
    config: sanearConfigImportada(formato, rawDoc.config),
  };

  // 2. Sanear Elementos
  const rawElementos = Array.isArray(item.elementos) ? item.elementos : [];
  const elementos = [];
  const tiposValidos = Object.values(TIPOS_ELEMENTO);

  for (const el of rawElementos) {
    if (!el || typeof el !== 'object') continue;
    if (!tiposValidos.includes(el.tipo)) continue;
    if (!esNumeroFinito(el.x) || !esNumeroFinito(el.y) || !esNumeroFinito(el.ancho) || !esNumeroFinito(el.alto)) continue;
    if (Math.abs(el.x) > COORD_MAX || Math.abs(el.y) > COORD_MAX || el.ancho < 0 || el.alto < 0 || el.ancho > COORD_MAX || el.alto > COORD_MAX) continue;

    const elId = typeof el.id === 'string' && el.id.trim().length > 0 ? el.id.trim() : nuevoId();
    const z = esNumeroFinito(el.z) ? el.z : 0;
    const contenedor = (typeof el.contenedor === 'string' && el.contenedor.length <= 100) || esNumeroFinito(el.contenedor) ? el.contenedor : null;
    const datosOriginales = el.datos && typeof el.datos === 'object' ? el.datos : {};
    let datosSaneados = {};

    if (el.tipo === TIPOS_ELEMENTO.TEXTO) {
      const bloques = sanearBloquesTexto(datosOriginales.bloques || []);
      const tamano = esNumeroFinito(datosOriginales.tamano) ? Math.max(4, Math.min(400, datosOriginales.tamano)) : 18;
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#14192b';
      datosSaneados = { bloques, tamano, color };
    } else if (el.tipo === TIPOS_ELEMENTO.TRAZO) {
      const puntos = (Array.isArray(datosOriginales.puntos) ? datosOriginales.puntos : []).filter(
        (p) => Array.isArray(p) && esNumeroFinito(p[0]) && esNumeroFinito(p[1])
      );
      if (!puntos.length) continue;
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#14192b';
      const grosor = esNumeroFinito(datosOriginales.grosor) ? Math.max(0.5, Math.min(100, datosOriginales.grosor)) : 3;
      const opacidad = esNumeroFinito(datosOriginales.opacidad) ? Math.max(0.05, Math.min(1, datosOriginales.opacidad)) : 1;
      const herramienta = ['lapiz', 'resaltador', 'borrador'].includes(datosOriginales.herramienta) ? datosOriginales.herramienta : 'lapiz';
      datosSaneados = { puntos, color, grosor, opacidad, herramienta };
    } else if (el.tipo === TIPOS_ELEMENTO.FIGURA) {
      const formasValidas = ['rectangulo', 'elipse', 'triangulo', 'rombo', 'linea', 'flecha'];
      const forma = formasValidas.includes(datosOriginales.forma) ? datosOriginales.forma : 'rectangulo';
      const borde = esColorValido(datosOriginales.borde) ? datosOriginales.borde : '#2350d8';
      const relleno = esColorValido(datosOriginales.relleno) ? datosOriginales.relleno : null;
      const grosor = esNumeroFinito(datosOriginales.grosor) ? Math.max(1, Math.min(40, datosOriginales.grosor)) : 3;
      datosSaneados = {
        forma, borde, relleno, grosor,
        volteoX: !!datosOriginales.volteoX,
        volteoY: !!datosOriginales.volteoY,
      };
    } else if (el.tipo === TIPOS_ELEMENTO.SIMBOLO) {
      const caracter = typeof datosOriginales.caracter === 'string' ? datosOriginales.caracter.slice(0, 4) : '?';
      const tamano = esNumeroFinito(datosOriginales.tamano) ? Math.max(4, Math.min(600, datosOriginales.tamano)) : 32;
      const color = esColorValido(datosOriginales.color) ? datosOriginales.color : '#14192b';
      datosSaneados = { caracter, tamano, color };
    } else if (el.tipo === TIPOS_ELEMENTO.IMAGEN) {
      if (!datosOriginales.blobId || typeof datosOriginales.blobId !== 'string') continue;
      datosSaneados = {
        blobId: datosOriginales.blobId,
        anchoOriginal: esNumeroFinito(datosOriginales.anchoOriginal) ? datosOriginales.anchoOriginal : el.ancho,
        altoOriginal: esNumeroFinito(datosOriginales.altoOriginal) ? datosOriginales.altoOriginal : el.alto,
        recorte: datosOriginales.recorte && typeof datosOriginales.recorte === 'object' ? {
          x: esNumeroFinito(datosOriginales.recorte.x) ? datosOriginales.recorte.x : 0,
          y: esNumeroFinito(datosOriginales.recorte.y) ? datosOriginales.recorte.y : 0,
          ancho: esNumeroFinito(datosOriginales.recorte.ancho) ? datosOriginales.recorte.ancho : 1,
          alto: esNumeroFinito(datosOriginales.recorte.alto) ? datosOriginales.recorte.alto : 1,
        } : null,
      };
    }

    elementos.push({
      id: elId,
      documentoId: docId,
      tipo: el.tipo,
      x: el.x,
      y: el.y,
      ancho: el.ancho,
      alto: el.alto,
      z,
      contenedor,
      datos: datosSaneados,
      creado: esNumeroFinito(el.creado) ? el.creado : creado,
      modificado: esNumeroFinito(el.modificado) ? el.modificado : modificado,
    });
  }

  // 3. Sanear Recursos (blobs / imágenes en base64)
  const rawRecursos = Array.isArray(item.recursos) ? item.recursos : [];
  const recursos = [];
  const MIME_IMAGEN = /^image\/(png|jpeg|jpg|webp|svg\+xml|gif)$/i;

  for (const rec of rawRecursos) {
    if (!rec || typeof rec !== 'object') continue;
    if (!rec.id || typeof rec.id !== 'string') continue;
    if (!rec.base64 || typeof rec.base64 !== 'string') continue;
    const tipo = MIME_IMAGEN.test(rec.tipo) ? rec.tipo.toLowerCase() : 'image/png';
    const nombre = String(rec.nombre || 'imagen').replace(/[<>]/g, '').slice(0, 100);
    recursos.push({
      id: rec.id,
      tipo,
      nombre,
      tamano: esNumeroFinito(rec.tamano) ? rec.tamano : Math.round(rec.base64.length * 0.75),
      base64: rec.base64,
    });
  }

  return { documento, elementos, recursos };
}
