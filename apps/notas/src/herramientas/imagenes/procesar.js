export const MAX_LADO_IMAGEN = 2400;
export const MAX_BYTES_IMAGEN = 4 * 1024 * 1024;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function dimensionesReducidas(ancho, alto, tamanoBytes = 0) {
  if (!(ancho > 0 && alto > 0 && Number.isFinite(ancho) && Number.isFinite(alto))) {
    throw new Error('No se pudieron leer las dimensiones de la imagen.');
  }
  const porLado = Math.min(1, MAX_LADO_IMAGEN / Math.max(ancho, alto));
  const porPeso = tamanoBytes > MAX_BYTES_IMAGEN ? Math.sqrt(MAX_BYTES_IMAGEN / tamanoBytes) : 1;
  const escala = Math.min(porLado, porPeso);
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

async function decodificar(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* usar Image como compatibilidad */ }
  }
  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    throw new Error('Este navegador no puede abrir imágenes.');
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    if (image.decode) {
      await image.decode();
    } else {
      await new Promise((resolver, rechazar) => {
        image.onload = resolver;
        image.onerror = rechazar;
      });
    }
    return image;
  } catch {
    throw new Error('El archivo de imagen está dañado o no se puede leer.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobDelCanvas(canvas, tipo, calidad) {
  return new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => blob ? resolver(blob) : rechazar(new Error('No se pudo reducir la imagen.')), tipo, calidad);
  });
}

export async function procesarImagen(archivo) {
  if (!archivo || !TIPOS_IMAGEN.has(archivo.type)) throw new Error('Use una imagen PNG, JPEG o WebP.');
  const fuente = await decodificar(archivo);
  const anchoOriginal = fuente.width || fuente.naturalWidth;
  const altoOriginal = fuente.height || fuente.naturalHeight;
  const medida = dimensionesReducidas(anchoOriginal, altoOriginal, archivo.size);
  if (medida.ancho === anchoOriginal && medida.alto === altoOriginal && archivo.size <= MAX_BYTES_IMAGEN) {
    fuente.close?.();
    return { blob: archivo, anchoOriginal, altoOriginal, tipo: archivo.type, nombre: archivo.name || 'imagen' };
  }

  const canvas = document.createElement('canvas');
  canvas.width = medida.ancho; canvas.height = medida.alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) { fuente.close?.(); throw new Error('No se pudo preparar la imagen en este navegador.'); }
  ctx.drawImage(fuente, 0, 0, medida.ancho, medida.alto);
  fuente.close?.();

  const tipoSalida = archivo.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  const blob = await blobDelCanvas(canvas, tipoSalida, 0.84);
  const extension = blob.type === 'image/jpeg' ? '.jpg' : blob.type === 'image/webp' ? '.webp' : '.png';
  const base = (archivo.name || 'imagen').replace(/\.[^.]+$/, '');
  return { blob, anchoOriginal: medida.ancho, altoOriginal: medida.alto, tipo: blob.type, nombre: `${base}${extension}` };
}