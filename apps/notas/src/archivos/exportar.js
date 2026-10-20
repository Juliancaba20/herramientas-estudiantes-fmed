// Exportación de documentos individuales y colecciones completas (Etapa 12).
// Admite descarga directa y hoja de compartir del sistema (navigator.share) en iPads y móviles.

import { listarElementos, obtenerBlob, listarDocumentos, listarCarpetas } from '../almacen/index.js';
import { MIME_TIPO_NOTA, arrayBufferABase64, empaquetarDocumento, empaquetarColeccion } from './formato.js';

// Limpia un nombre para que sea seguro como nombre de archivo en cualquier sistema operativo
export function nombreArchivoSeguro(titulo, extension = 'nota') {
  const base = String(titulo || 'Sin título')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes para compatibilidad de archivo
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'nota';
  return `${base}.${extension}`;
}

// Descarga un Blob mediante un enlace temporal <a>
export function descargarBlob(blob, nombreArchivo) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// Intenta compartir un archivo mediante navigator.share (hoja nativa en iOS/iPad y Android).
// Devuelve 'compartido', 'cancelado' (la persona cerró la hoja sin guardar nada) o false (no disponible: usar descarga).
export async function intentarCompartirArchivo(blob, nombreArchivo, titulo) {
  if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
    try {
      const archivo = new File([blob], nombreArchivo, { type: MIME_TIPO_NOTA });
      if (navigator.canShare({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: titulo || 'Nota de Anotomía',
        });
        return 'compartido';
      }
    } catch (e) {
      // Si el usuario canceló la hoja de compartir (AbortError), no es un éxito ni un error: no se guardó nada
      if (e.name === 'AbortError') return 'cancelado';
    }
  }
  return false;
}

// Prepara los recursos (blobs a base64) de una lista de elementos
export async function prepararRecursosDeElementos(elementos) {
  const imagenes = elementos.filter((e) => e.tipo === 'imagen' && e.datos?.blobId);
  const blobIdsUnicos = [...new Set(imagenes.map((e) => e.datos.blobId))];
  const recursos = [];

  for (const bid of blobIdsUnicos) {
    const reg = await obtenerBlob(bid);
    if (!reg || !reg.blob) continue;

    let buffer = null;
    if (typeof reg.blob.arrayBuffer === 'function') {
      buffer = await reg.blob.arrayBuffer();
    } else if (reg.blob instanceof ArrayBuffer) {
      buffer = reg.blob;
    } else if (reg.blob.buffer instanceof ArrayBuffer) {
      buffer = reg.blob.buffer;
    }

    if (buffer) {
      recursos.push({
        id: reg.id,
        tipo: reg.tipo || 'image/png',
        nombre: reg.nombre || 'imagen',
        tamano: reg.tamano || buffer.byteLength,
        base64: arrayBufferABase64(buffer),
      });
    }
  }

  return recursos;
}

// Exporta un único documento en formato .nota
export async function exportarDocumento(doc, { elementos: elementosProvistos = null, compartir = true } = {}) {
  let elementos = elementosProvistos;
  if (!elementos) {
    try {
      elementos = await listarElementos(doc.id);
    } catch {
      elementos = [];
    }
  }
  const recursos = await prepararRecursosDeElementos(elementos);
  const bytes = await empaquetarDocumento(doc, elementos, recursos);
  const blob = new Blob([bytes], { type: MIME_TIPO_NOTA });
  const nombreArchivo = nombreArchivoSeguro(doc.titulo, 'nota');

  if (compartir) {
    const compartido = await intentarCompartirArchivo(blob, nombreArchivo, doc.titulo);
    if (compartido) return { metodo: compartido, nombreArchivo };
  }

  descargarBlob(blob, nombreArchivo);
  return { metodo: 'descargado', nombreArchivo };
}

// Exporta todos los documentos activos en un único archivo de copia de respaldo
export async function exportarTodasLasNotas({ compartir = false } = {}) {
  const documentos = await listarDocumentos({ papelera: false });
  const items = [];

  for (const doc of documentos) {
    const elementos = await listarElementos(doc.id);
    const recursos = await prepararRecursosDeElementos(elementos);
    items.push({ documento: doc, elementos, recursos });
  }

  const carpetas = await listarCarpetas();
  const bytes = await empaquetarColeccion(items, carpetas);
  const blob = new Blob([bytes], { type: MIME_TIPO_NOTA });
  const fechaStr = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Anotomia_Copia_Completa_${fechaStr}.anotomia-respaldo`;

  if (compartir) {
    const compartido = await intentarCompartirArchivo(blob, nombreArchivo, 'Copia de seguridad de Anotomía');
    if (compartido) return { metodo: compartido, nombreArchivo, cantidad: items.length };
  }

  descargarBlob(blob, nombreArchivo);
  return { metodo: 'descargado', nombreArchivo, cantidad: items.length };
}
