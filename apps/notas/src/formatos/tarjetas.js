// Formato Tarjetas (Etapa 9): fichas de estudio para una idea por tarjeta.
// Manejo de tamaños, proporciones, lista de tarjetas y contenedor de elementos.
import { nuevoId } from '../almacen/modelo.js';

// Escala física: 5 unidades del lienzo = 1 mm de papel. Así A6 y A5 miden lo que dicen al imprimir.
export const PX_POR_MM = 5;
export const MM_MIN = 40;
export const MM_MAX = 400;

const enMm = (ancho, alto, nombre) => ({ ancho, alto, nombre, anchoMm: ancho / PX_POR_MM, altoMm: alto / PX_POR_MM });

export const PROPORCIONES_TARJETA = {
  '16:9': enMm(1120, 630, '16:9 (Panorámica)'),
  '4:3': enMm(960, 720, '4:3 (Estándar)'),
  A6: enMm(740, 525, 'A6 (Ficha clásica, 148 × 105 mm)'),
  A5: enMm(1050, 740, 'A5 (Ficha grande, 210 × 148 mm)'),
};

const acotarMm = (v, defecto) => {
  if (v === '' || v === null || v === undefined) return defecto;
  if (typeof v === 'string' && !v.trim()) return defecto;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MM_MAX, Math.max(MM_MIN, Math.round(n))) : defecto;
};

export function normalizarPersonalizado(p) {
  return { anchoMm: acotarMm(p?.anchoMm, 150), altoMm: acotarMm(p?.altoMm, 100) };
}

export function medidasTarjeta(tamano = '16:9', personalizado = null) {
  if (tamano === 'personalizado') {
    const { anchoMm, altoMm } = normalizarPersonalizado(personalizado);
    return enMm(anchoMm * PX_POR_MM, altoMm * PX_POR_MM, `Personalizado (${anchoMm} × ${altoMm} mm)`);
  }
  return PROPORCIONES_TARJETA[tamano] || PROPORCIONES_TARJETA['16:9'];
}

// Normaliza la configuración de tarjetas dentro de doc.config
export function normalizarTarjetasConfig(config = {}) {
  const tamano = config.tamano === 'personalizado' || (config.tamano && PROPORCIONES_TARJETA[config.tamano]) ? config.tamano : '16:9';
  const tarjetas = Array.isArray(config.tarjetas) && config.tarjetas.length > 0
    ? config.tarjetas.map((t, idx) => ({
      id: t.id || nuevoId(),
      titulo: typeof t.titulo === 'string' ? t.titulo : `Tarjeta ${idx + 1}`,
    }))
    : [{ id: nuevoId(), titulo: 'Tarjeta 1' }];

  const activa = config.tarjetaActiva && tarjetas.some((t) => t.id === config.tarjetaActiva)
    ? config.tarjetaActiva
    : tarjetas[0].id;

  return {
    ...config,
    tamano,
    personalizado: normalizarPersonalizado(config.personalizado),
    tarjetas,
    tarjetaActiva: activa,
    imprimirRenglones: config.imprimirRenglones !== undefined ? !!config.imprimirRenglones : false,
    porHoja: [1, 2, 4, 6].includes(config.porHoja) ? config.porHoja : 1,
    marcasDeCorte: !!config.marcasDeCorte,
  };
}

// Mueve una tarjeta de una posición a otra (devuelve una lista nueva).
export function moverTarjeta(lista, desde, hasta) {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) return lista;
  const copia = [...lista];
  const [t] = copia.splice(desde, 1);
  copia.splice(hasta, 0, t);
  return copia;
}

// Calcula el índice de destino al arrastrar una tarjeta sobre una lista vertical (tira) o cuadrícula.
export function calcularDestinoArrastre(rects, pos) {
  if (!rects || !rects.length) return 0;
  if (rects.length === 1) return 0;

  const y = typeof pos === 'number' ? pos : (pos?.y ?? 0);
  const x = typeof pos === 'object' ? (pos?.x ?? 0) : 0;

  const normalizados = rects.map((r) => {
    const top = r.top !== undefined ? r.top : (r.y !== undefined ? r.y : 0);
    const bottom = r.bottom !== undefined ? r.bottom : (top + (r.alto || r.height || 0));
    const left = r.left !== undefined ? r.left : (r.x !== undefined ? r.x : undefined);
    const right = r.right !== undefined ? r.right : (left !== undefined ? left + (r.ancho || r.width || 0) : undefined);
    return { top, bottom, left, right };
  });

  const esVertical = normalizados.every(
    (r) => r.left === undefined || Math.abs(r.left - (normalizados[0].left || 0)) < 10,
  );

  if (esVertical) {
    const primerCentro = normalizados[0].top + (normalizados[0].bottom - normalizados[0].top) / 2;
    if (y < primerCentro) return 0;

    const ult = normalizados[normalizados.length - 1];
    const ultCentro = ult.top + (ult.bottom - ult.top) / 2;
    if (y >= ultCentro) return normalizados.length - 1;

    for (let i = 0; i < normalizados.length - 1; i++) {
      const c1 = normalizados[i].top + (normalizados[i].bottom - normalizados[i].top) / 2;
      const c2 = normalizados[i + 1].top + (normalizados[i + 1].bottom - normalizados[i + 1].top) / 2;
      if (y >= c1 && y < c2) {
        return (y - c1 < c2 - y) ? i : i + 1;
      }
    }
    return normalizados.length - 1;
  }

  // Cuadrícula 2D
  let mejorDist = Infinity;
  let mejorIndice = 0;

  for (let i = 0; i < normalizados.length; i++) {
    const r = normalizados[i];
    const cx = r.left !== undefined && r.right !== undefined ? (r.left + r.right) / 2 : 0;
    const cy = r.top + (r.bottom - r.top) / 2;
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist < mejorDist) {
      mejorDist = dist;
      mejorIndice = i;
    }
  }

  return Math.max(0, Math.min(normalizados.length - 1, mejorIndice));
}

// Distribución de tarjetas por hoja A4 vertical: 1, 2, 4 o 6.
export const HOJA_A4_MM = { ancho: 210, alto: 297, margen: 10, aire: 6 };
const REJILLAS = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3] };

export function distribucionHoja(porHoja = 1) {
  const [columnas, filas] = REJILLAS[porHoja] || REJILLAS[1];
  return { columnas, filas, porHoja: columnas * filas };
}

// Tamaño con que sale impresa una tarjeta: nunca más grande que el real, y reducida solo si no cabe en su celda.
export function tamanoImpreso(med, porHoja = 1) {
  const { columnas, filas } = distribucionHoja(porHoja);
  const celdaAncho = (HOJA_A4_MM.ancho - 2 * HOJA_A4_MM.margen) / columnas - 2 * HOJA_A4_MM.aire;
  const celdaAlto = (HOJA_A4_MM.alto - 2 * HOJA_A4_MM.margen) / filas - 2 * HOJA_A4_MM.aire - 6; // 6 mm para el rótulo
  const escala = Math.min(1, celdaAncho / med.anchoMm, celdaAlto / med.altoMm);
  return { anchoMm: med.anchoMm * escala, altoMm: med.altoMm * escala, escala };
}

// Filtra los elementos correspondientes a una tarjeta específica
export function elementosDeTarjeta(elementos, tarjetaId, esPrimeraTarjeta = false) {
  return elementos.filter((el) => {
    if (el.contenedor === tarjetaId) return true;
    if (esPrimeraTarjeta && (!el.contenedor || el.contenedor === 'null')) return true;
    return false;
  });
}

// Documentos antiguos: los elementos que no pertenecen a ninguna tarjeta pasan a la primera.
// No modifica la lista recibida. Devuelve { elementos, cambiados } (cambiados = los que hay que volver a guardar).
export function asignarHuerfanos(elementos, primeraTarjetaId) {
  const cambiados = [];
  const nuevos = elementos.map((el) => {
    if (el.contenedor && el.contenedor !== 'null') return el;
    const mod = { ...el, contenedor: primeraTarjetaId };
    cambiados.push(mod);
    return mod;
  });
  return { elementos: nuevos, cambiados };
}

// Clona los elementos de una tarjeta para duplicarla
export function duplicarElementosTarjeta(elementos, origenId, destinoId, nuevoIdFn = nuevoId) {
  return elementos
    .filter((el) => el.contenedor === origenId)
    .map((el) => ({
      ...el,
      id: nuevoIdFn(),
      contenedor: destinoId,
      creado: Date.now(),
      modificado: Date.now(),
    }));
}
