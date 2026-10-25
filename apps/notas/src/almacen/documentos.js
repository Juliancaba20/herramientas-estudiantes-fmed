import { pedido, transaccion } from './db.js';
import { nuevoId } from './modelo.js';

// tocarFecha: false guarda sin cambiar la fecha de modificación (por ejemplo, al mover solo la cámara).
// Cuando se guardó con cambios avisa con el evento «anotomia:documento-guardado»: el programa de computadora lo usa
// para escribir también el archivo real del documento (src/archivos/disco.js). El almacén no sabe nada de archivos.
export const EVENTO_DOCUMENTO_GUARDADO = 'anotomia:documento-guardado';

export function guardarDocumento(doc, { tocarFecha = true } = {}) {
  const actualizado = tocarFecha ? { ...doc, modificado: Date.now() } : { ...doc };
  return transaccion(['documentos'], 'readwrite', (tx) => pedido(tx.objectStore('documentos').put(actualizado))).then(() => {
    if (tocarFecha && typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent(EVENTO_DOCUMENTO_GUARDADO, { detail: { id: actualizado.id } }));
    }
    return actualizado;
  });
}

export function obtenerDocumento(id) {
  return transaccion(['documentos'], 'readonly', (tx) => pedido(tx.objectStore('documentos').get(id)));
}

// orden: 'fecha' (más recientes primero) o 'nombre' (A–Z)
export async function listarDocumentos({ papelera = false, orden = 'fecha' } = {}) {
  const todos = await transaccion(['documentos'], 'readonly', (tx) => pedido(tx.objectStore('documentos').getAll()));
  const lista = [];
  for (const d of todos) {
    if (!d || typeof d !== 'object' || !d.id) {
      // Documento dañado a nivel registro: aislarlo para no romper la biblioteca
      lista.push({
        id: (d && d.id) || `corrupto_${Math.random().toString(36).slice(2, 9)}`,
        titulo: (d && d.titulo) || 'Documento no legible (dañado)',
        formato: (d && d.formato) || 'pizarron',
        creado: (d && d.creado) || Date.now(),
        modificado: (d && d.modificado) || Date.now(),
        papelera: d && d.papelera !== undefined ? d.papelera : null,
        _danado: true,
      });
      continue;
    }
    const esPapelera = d.papelera !== null && d.papelera !== undefined;
    if (esPapelera === papelera) lista.push(d);
  }
  if (orden === 'nombre') lista.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' }));
  else lista.sort((a, b) => (b.modificado || 0) - (a.modificado || 0));
  return lista;
}

export function enviarAPapelera(doc) {
  return guardarDocumento({ ...doc, papelera: Date.now() });
}

export function restaurarDePapelera(doc) {
  return guardarDocumento({ ...doc, papelera: null });
}

// Borra el documento, sus elementos y los blobs que queden sin referencias en una sola transacción.
// Optimizado para no cargar todos los elementos de la base completa en memoria.
export function borrarDocumentoDefinitivo(id) {
  return transaccion(['documentos', 'elementos', 'blobs'], 'readwrite', async (tx) => {
    const els = tx.objectStore('elementos');
    const claves = await pedido(els.index('documentoId').getAllKeys(id));
    const elementosDoc = await pedido(els.index('documentoId').getAll(id));
    claves.forEach((k) => els.delete(k));
    tx.objectStore('documentos').delete(id);

    // Identificar únicamente los blobs del documento eliminado
    const blobsCandidatos = new Set(
      elementosDoc.filter((el) => el.tipo === 'imagen' && el.datos?.blobId).map((el) => el.datos.blobId)
    );
    if (!blobsCandidatos.size) return;

    // Solo verificamos si esos blobs candidatos específicos están referenciados por otros elementos
    const cursor = els.openCursor();
    const usadosPorOtros = new Set();
    await new Promise((resolve, reject) => {
      cursor.onsuccess = (e) => {
        const cur = e.target.result;
        if (!cur) { resolve(); return; }
        const el = cur.value;
        if (el.tipo === 'imagen' && el.datos?.blobId && blobsCandidatos.has(el.datos.blobId)) {
          usadosPorOtros.add(el.datos.blobId);
        }
        cur.continue();
      };
      cursor.onerror = () => reject(cursor.error);
    });

    const storeBlobs = tx.objectStore('blobs');
    for (const bId of blobsCandidatos) {
      if (!usadosPorOtros.has(bId)) {
        storeBlobs.delete(bId);
      }
    }
  });
}

// Copia un documento con todos sus elementos, en una sola transacción.
// Los elementos reciben identificadores nuevos; `contenedor` (tarjeta o página) se conserva
// porque solo tiene sentido dentro de su propio documento.
export function duplicarDocumento(id, titulo) {
  return transaccion(['documentos', 'elementos'], 'readwrite', async (tx) => {
    const original = await pedido(tx.objectStore('documentos').get(id));
    if (!original) throw new Error('El documento ya no existe.');
    const ahora = Date.now();
    const copia = { ...structuredClone(original), id: nuevoId(), titulo: titulo || `Copia de ${original.titulo}`, creado: ahora, modificado: ahora, papelera: null };
    const els = tx.objectStore('elementos');
    const originales = await pedido(els.index('documentoId').getAll(id));
    originales.forEach((e) => els.put({ ...structuredClone(e), id: nuevoId(), documentoId: copia.id, creado: ahora, modificado: ahora }));
    tx.objectStore('documentos').put(copia);
    return copia;
  });
}

// Elimina para siempre todos los documentos de la papelera (o los de antes de `antesDe`).
export async function vaciarPapelera({ antesDe = Infinity } = {}) {
  const enPapelera = await listarDocumentos({ papelera: true });
  const ids = enPapelera.filter((d) => d.papelera < antesDe).map((d) => d.id);
  for (const id of ids) await borrarDocumentoDefinitivo(id);
  return ids.length;
}

// La papelera es temporal: lo que lleva más de `dias` días se elimina solo.
export function purgarPapeleraVieja(dias = 30) {
  return vaciarPapelera({ antesDe: Date.now() - dias * 86400000 });
}
