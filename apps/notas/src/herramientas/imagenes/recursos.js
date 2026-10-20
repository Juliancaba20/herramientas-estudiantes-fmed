import { obtenerBlob } from '../../almacen/blobs.js';

const recursos = new Map();

async function decodificar(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return { imagen: await createImageBitmap(blob), bitmap: true }; } catch { /* compatibilidad */ }
  }
  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') throw new Error('Este navegador no puede mostrar imágenes.');
  const url = URL.createObjectURL(blob);
  try {
    const imagen = new Image();
    imagen.src = url;
    if (imagen.decode) await imagen.decode();
    else await new Promise((resolver, rechazar) => { imagen.onload = resolver; imagen.onerror = rechazar; });
    return { imagen, bitmap: false };
  } finally { URL.revokeObjectURL(url); }
}

function recurso(id) {
  let r = recursos.get(id);
  if (!r) { r = { imagen: null, bitmap: false, promesa: null, canvas: new Set(), avisos: new Map(), retenes: 0, error: null }; recursos.set(id, r); }
  return r;
}

function liberarSiNoSeUsa(id, r) {
  if (r.canvas.size || r.retenes || !r.imagen) return;
  if (r.bitmap) r.imagen.close?.();
  else r.imagen.src = '';
  recursos.delete(id);
}

export function imagenEnCache(id, canvas = null, alLista = null) {
  if (!id) return null;
  const r = recurso(id);
  if (canvas) {
    r.canvas.add(canvas);
    if (alLista) r.avisos.set(canvas, alLista);
  }
  if (r.imagen || r.error) return r.imagen;
  if (!r.promesa) {
    r.promesa = obtenerBlob(id).then(async (fila) => {
      if (!fila?.blob) throw new Error(`No se encontró la imagen ${id}.`);
      const cargada = await decodificar(fila.blob);
      r.imagen = cargada.imagen; r.bitmap = cargada.bitmap;
      for (const [cv, avisar] of r.avisos) avisar(cv);
      r.avisos.clear();
      liberarSiNoSeUsa(id, r);
      return r.imagen;
    }).catch((error) => { r.error = error; r.avisos.clear(); if (!r.canvas.size && !r.retenes) recursos.delete(id); return null; });
  }
  return null;
}

export async function prepararImagenes(elementos) {
  const ids = [...new Set(elementos.filter((el) => el.tipo === 'imagen' && el.datos?.blobId).map((el) => el.datos.blobId))];
  const referencias = ids.map((id) => { const r = recurso(id); r.retenes++; imagenEnCache(id); return [id, r]; });
  await Promise.all(referencias.map(([, r]) => r.promesa));
  let liberado = false;
  return {
    imagenes: referencias.map(([, r]) => r.imagen).filter(Boolean),
    liberar() {
      if (liberado) return;
      liberado = true;
      for (const [id, r] of referencias) { r.retenes = Math.max(0, r.retenes - 1); liberarSiNoSeUsa(id, r); }
    },
  };
}

export function liberarImagenesCanvas(canvas) {
  for (const [id, r] of recursos) {
    r.canvas.delete(canvas); r.avisos.delete(canvas);
    liberarSiNoSeUsa(id, r);
  }
}