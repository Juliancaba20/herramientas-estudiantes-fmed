// Gestión de carpetas y materias de la biblioteca (Etapa 14 / Parte F).
// Modelo plano de materias de un solo nivel con color identificativo y asignación directa.

import { obtenerAjuste, guardarAjuste } from './ajustes.js';
import { listarDocumentos, guardarDocumento } from './documentos.js';
import { nuevoId } from './modelo.js';

export const CLAVE_CARPETAS = 'biblioteca.carpetas';

export const COLORES_CARPETA = [
  ['#2350d8', 'Azul'],
  ['#1f9d55', 'Verde'],
  ['#e67700', 'Naranja'],
  ['#d6336c', 'Rosa'],
  ['#7048e8', 'Violeta'],
  ['#0c8599', 'Turquesa'],
  ['#d9480f', 'Rojo teja'],
  ['#495057', 'Gris plomo'],
];

export async function listarCarpetas() {
  const lista = await obtenerAjuste(CLAVE_CARPETAS, []);
  if (!Array.isArray(lista)) return [];
  return lista.map((c) => ({
    id: String(c.id || nuevoId()),
    nombre: String(c.nombre || 'Nueva materia').slice(0, 100).trim(),
    color: COLORES_CARPETA.some(([hex]) => hex === c.color) ? c.color : COLORES_CARPETA[0][0],
    creado: typeof c.creado === 'number' ? c.creado : Date.now(),
  }));
}

export async function guardarCarpeta({ id, nombre, color }) {
  const lista = await listarCarpetas();
  const nombreLimpio = String(nombre || '').trim().slice(0, 100) || 'Sin nombre';
  const colorValido = COLORES_CARPETA.some(([hex]) => hex === color) ? color : COLORES_CARPETA[0][0];

  let nuevaLista;
  let carpetaResultante;

  if (id) {
    nuevaLista = lista.map((c) => {
      if (c.id === id) {
        carpetaResultante = { ...c, nombre: nombreLimpio, color: colorValido };
        return carpetaResultante;
      }
      return c;
    });
    if (!carpetaResultante) {
      carpetaResultante = { id, nombre: nombreLimpio, color: colorValido, creado: Date.now() };
      nuevaLista.push(carpetaResultante);
    }
  } else {
    carpetaResultante = { id: nuevoId(), nombre: nombreLimpio, color: colorValido, creado: Date.now() };
    nuevaLista = [...lista, carpetaResultante];
  }

  await guardarAjuste(CLAVE_CARPETAS, nuevaLista);
  return carpetaResultante;
}

// Elimina una carpeta y desvincula las notas asociadas (pasan a "Sin carpeta", nunca se eliminan)
export async function eliminarCarpeta(id) {
  const lista = await listarCarpetas();
  const nuevaLista = lista.filter((c) => c.id !== id);
  await guardarAjuste(CLAVE_CARPETAS, nuevaLista);

  // Desvincular de los documentos sin alterar sus contenidos
  const docs = await listarDocumentos();
  for (const doc of docs) {
    if (doc.carpetaId === id) {
      await guardarDocumento({ ...doc, carpetaId: null }, { tocarFecha: false });
    }
  }
  return nuevaLista;
}

// Asigna un documento a una carpeta (o lo quita con null)
export async function moverDocumentoACarpeta(docId, carpetaId) {
  const docs = await listarDocumentos();
  const doc = docs.find((d) => d.id === docId);
  if (!doc) throw new Error('El documento no existe.');
  const idValido = carpetaId ? String(carpetaId).trim() : null;
  const actualizado = { ...doc, carpetaId: idValido };
  await guardarDocumento(actualizado, { tocarFecha: false });
  return actualizado;
}

// Asigna o actualiza las etiquetas de un documento
export async function asignarEtiquetasDocumento(docId, etiquetas) {
  const docs = await listarDocumentos();
  const doc = docs.find((d) => d.id === docId);
  if (!doc) throw new Error('El documento no existe.');
  const tagsLimpias = Array.isArray(etiquetas)
    ? [...new Set(etiquetas.map((t) => String(t || '').trim().replace(/^#+/, '').slice(0, 40)).filter(Boolean))]
    : [];
  const actualizado = { ...doc, etiquetas: tagsLimpias };
  await guardarDocumento(actualizado, { tocarFecha: false });
  return actualizado;
}
