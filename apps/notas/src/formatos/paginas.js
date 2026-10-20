// Formato Páginas A4 (Etapa 10): hojas continuas una debajo de otra, como un documento.
// Dimensiones estándar A4 (794 × 1123 px a 96 DPI), marcos verticales, paginación e interlineado.
export const ANCHO_A4 = 794;
export const ALTO_A4 = 1123;
export const ESPACIO_PAGINAS = 50; // Separación visual entre hojas consecutivas
export const PASO_PAGINA = ALTO_A4 + ESPACIO_PAGINAS; // 1173 px

export const MARGENES_A4 = {
  superior: 60,
  inferior: 60,
  izquierdo: 60,
  derecho: 60,
};

// Devuelve el rectángulo de una página en el espacio continuo del mundo
export function marcoDePagina(numero) {
  const n = Math.max(1, Math.round(numero || 1));
  const idx = n - 1;
  return {
    x: 0,
    y: idx * PASO_PAGINA,
    ancho: ANCHO_A4,
    alto: ALTO_A4,
    numero: n,
  };
}

// Devuelve la lista completa de marcos para las N páginas del documento
export function marcosDePaginas(cantidad) {
  const n = Math.max(1, Math.round(cantidad || 1));
  return Array.from({ length: n }, (_, i) => marcoDePagina(i + 1));
}

// Determina el número de página (1-indexado) según la coordenada vertical Y del mundo
export function paginaEnY(y) {
  if (y <= 0) return 1;
  return Math.floor(y / PASO_PAGINA) + 1;
}

// Devuelve el inicio Y de una página específica
export function yDePagina(numero) {
  const n = Math.max(1, Math.round(numero || 1));
  return (n - 1) * PASO_PAGINA;
}

// Normaliza la configuración del formato de páginas
export function normalizarPaginasConfig(config = {}) {
  const cantidad = Math.max(1, Math.round(+config.cantidadPaginas || (Array.isArray(config.paginas) ? config.paginas.length : 1)));
  const activa = Math.max(1, Math.min(cantidad, Math.round(+config.paginaActiva || 1)));

  return {
    ...config,
    cantidadPaginas: cantidad,
    paginaActiva: activa,
    margenes: { ...MARGENES_A4, ...(config.margenes || {}) },
    imprimirRenglones: config.imprimirRenglones !== undefined ? !!config.imprimirRenglones : false,
    flujoAutomatico: config.flujoAutomatico !== undefined ? !!config.flujoAutomatico : false,
    encabezado: {
      activo: !!config.encabezado?.activo,
      texto: typeof config.encabezado?.texto === 'string' ? config.encabezado.texto : '',
      numeracion: !!config.encabezado?.numeracion,
    },
    pie: {
      activo: !!config.pie?.activo,
      texto: typeof config.pie?.texto === 'string' ? config.pie.texto : '',
      numeracion: !!config.pie?.numeracion,
    },
  };
}

// Formatea el texto de encabezado o pie para una página específica (número y total)
export function formatearTextoGuiaPagina(configuracion, numero, total) {
  if (!configuracion || !configuracion.activo) return '';
  const partes = [];
  const txt = (configuracion.texto || '').trim();
  if (txt) partes.push(txt);
  if (configuracion.numeracion) {
    partes.push(`Página ${numero} de ${total}`);
  }
  return partes.join(' · ');
}

// Obtiene el último número correlativo alcanzado en una lista de bloques
export function obtenerUltimoNumeroLista(bloques) {
  if (!Array.isArray(bloques)) return 0;
  let cont = 0;
  for (const b of bloques) {
    if (b.tipo === 'numero') {
      cont = (b.inicio && b.inicio > 0) ? b.inicio : cont + 1;
    }
  }
  return cont;
}

// Configura el inicio de la lista numerada en el primer bloque tipo 'numero'
export function continuarListaNumeradaEnBloques(bloques, numeroInicial) {
  if (!Array.isArray(bloques) || !(numeroInicial > 0)) return bloques;
  let primerNumero = false;
  return bloques.map((b) => {
    if (b.tipo === 'numero' && !primerNumero) {
      primerNumero = true;
      return { ...b, inicio: numeroInicial };
    }
    return b;
  });
}

// Divide un elemento de texto entre la página actual y la siguiente conservando correlatividad
export function partirTextoPorDesborde(el, marco, nuevoIdFn) {
  if (el.tipo !== 'texto' || !Array.isArray(el.datos?.bloques) || el.datos.bloques.length <= 1) {
    return null;
  }
  const bloques = el.datos.bloques;
  const alturaDisponible = Math.max(80, (marco.y + marco.alto - MARGENES_A4.inferior) - el.y);
  if (alturaDisponible >= el.alto || el.alto <= 0) return null;

  const proporcion = Math.max(0.1, Math.min(0.9, alturaDisponible / el.alto));
  const puntoCorte = Math.max(1, Math.min(bloques.length - 1, Math.floor(bloques.length * proporcion)));

  const bloquesParte1 = bloques.slice(0, puntoCorte);
  const bloquesParte2 = bloques.slice(puntoCorte);

  const ultimoNumero = obtenerUltimoNumeroLista(bloquesParte1);
  const bloquesParte2Ajustados = ultimoNumero > 0
    ? continuarListaNumeradaEnBloques(bloquesParte2, ultimoNumero + 1)
    : bloquesParte2;

  const elemento1 = {
    ...el,
    datos: { ...el.datos, bloques: bloquesParte1 },
  };

  const paginaSiguiente = marco.numero + 1;
  const elemento2 = {
    ...el,
    id: nuevoIdFn(),
    y: yDePagina(paginaSiguiente) + MARGENES_A4.superior,
    contenedor: paginaSiguiente,
    creado: Date.now(),
    modificado: Date.now(),
    datos: { ...el.datos, bloques: bloquesParte2Ajustados },
  };

  return { elemento1, elemento2, paginaSiguiente };
}

// Página a la que pertenece un elemento: se decide siempre por su posición actual (el centro vertical),
// así sigue siendo correcta aunque el elemento se haya movido de una hoja a otra o cruce un borde.
export function paginaDeElemento(el) {
  return paginaEnY((el.y || 0) + (el.alto || 0) / 2);
}

export function desbordeDePagina(el, margenes = MARGENES_A4) {
  const pagina = paginaDeElemento(el);
  const marco = marcoDePagina(pagina);
  return {
    pagina,
    superior: el.y < marco.y + margenes.superior,
    inferior: el.y + el.alto > marco.y + marco.alto - margenes.inferior,
    izquierdo: el.x < marco.x + margenes.izquierdo,
    derecho: el.x + el.ancho > marco.x + marco.ancho - margenes.derecho,
  };
}

export function cabeEnPagina(el, margenes = MARGENES_A4) {
  return el.ancho <= ANCHO_A4 - margenes.izquierdo - margenes.derecho
    && el.alto <= ALTO_A4 - margenes.superior - margenes.inferior;
}

export function moverElementoAPagina(el, numero, margenes = MARGENES_A4) {
  const destino = Math.max(1, Math.round(numero || 1));
  const xMin = margenes.izquierdo;
  const xMax = ANCHO_A4 - margenes.derecho - el.ancho;
  return {
    ...el,
    x: Math.max(xMin, Math.min(el.x, xMax)),
    y: yDePagina(destino) + margenes.superior,
    contenedor: destino,
  };
}

// Filtra los elementos que corresponden a una página determinada.
// Si se indica la cantidad de páginas, la última recoge también lo que haya quedado más abajo.
export function elementosDePagina(elementos, numero, cantidad = 0) {
  const n = Math.max(1, Math.round(numero || 1));
  return elementos.filter((el) => {
    const p = paginaDeElemento(el);
    return p === n || (cantidad > 0 && n === cantidad && p > n);
  });
}

// Clona los elementos de una página desplazando sus coordenadas a la página de destino
export function duplicarElementosPagina(elementos, numOrigen, numDestino, nuevoIdFn, cantidad = 0) {
  const deltaY = yDePagina(numDestino) - yDePagina(numOrigen);

  return elementosDePagina(elementos, numOrigen, cantidad).map((el) => {
    const desplazado = {
      ...el,
      id: nuevoIdFn(),
      contenedor: numDestino,
      y: el.y + deltaY,
      creado: Date.now(),
      modificado: Date.now(),
    };

    // Si es un trazo, desplazar cada punto
    if (el.tipo === 'trazo' && el.datos?.puntos) {
      desplazado.datos = {
        ...el.datos,
        puntos: el.datos.puntos.map(([px, py, pr]) => [px, py + deltaY, pr]),
      };
    }
    return desplazado;
  });
}

// Cambios para quitar una página: borra sus elementos y sube un lugar los de las páginas siguientes.
export function cambiosEliminarPagina(elementos, numero, cantidad) {
  const aBorrar = new Set(elementosDePagina(elementos, numero, cantidad).map((e) => e.id));
  const cambios = [];
  for (const el of elementos) {
    if (aBorrar.has(el.id)) { cambios.push({ id: el.id, antes: el, despues: null }); continue; }
    const p = paginaDeElemento(el);
    if (p <= numero) continue;
    const nuevo = { ...el, y: el.y - PASO_PAGINA, contenedor: p - 1 };
    if (el.tipo === 'trazo' && el.datos?.puntos) nuevo.datos = { ...el.datos, puntos: el.datos.puntos.map(([px, py, pr]) => [px, py - PASO_PAGINA, pr]) };
    cambios.push({ id: el.id, antes: el, despues: nuevo });
  }
  return cambios;
}
