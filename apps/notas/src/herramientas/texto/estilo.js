// Estilo común del texto con teclado (Etapa 6). Lo usan la maquetación del lienzo y el editor,
// y el CSS del editor se genera desde estas mismas constantes: así lo que se ve al escribir
// y lo que queda dibujado en el lienzo no pueden desalinearse.

export const FUENTE_TEXTO = "'Source Serif 4 Variable', Georgia, serif";
export const TAMANO_TEXTO = 20; // tamaño base por defecto, en unidades del mundo
export const COLOR_TEXTO = '#14192b';
export const TAMANOS_TEXTO = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128];

// factor: tamaño respecto de la base · interlinea: altura de renglón · despues: separación posterior (en em del bloque)
export const BLOQUES = {
  parrafo: { factor: 1, negrita: false, interlinea: 1.4, despues: 0.4 },
  titulo1: { factor: 1.9, negrita: true, interlinea: 1.2, despues: 0.5 },
  titulo2: { factor: 1.5, negrita: true, interlinea: 1.25, despues: 0.45 },
  titulo3: { factor: 1.25, negrita: true, interlinea: 1.3, despues: 0.4 },
  vineta: { factor: 1, negrita: false, interlinea: 1.4, despues: 0.15, lista: true },
  numero: { factor: 1, negrita: false, interlinea: 1.4, despues: 0.15, lista: true },
};
export const ETIQUETA_BLOQUE = { parrafo: 'p', titulo1: 'h1', titulo2: 'h2', titulo3: 'h3' };
export const ALINEACIONES = ['izquierda', 'centro', 'derecha'];

export const SANGRIA_LISTA = 1.6; // em por nivel
export const FIN_LISTA = 0.4; // separación tras terminar una lista (em)
export const NIVEL_MAX = 2;
export const MARCAS_VINETA = ['•', '◦', '▪'];

export const TABLA = { padX: 0.5, padY: 0.35, despues: 0.5, borde: 1, colorBorde: '#b9c4e0', colorEncabezado: '#eaf0ff', maxFilas: 200, maxColumnas: 12 };

export function fuente({ negrita, cursiva } = {}, tam, negritaBase = false) {
  return `${cursiva ? 'italic ' : ''}${negrita || negritaBase ? 700 : 400} ${tam}px ${FUENTE_TEXTO}`;
}

// CSS estructural del editor, derivado de las constantes anteriores. El selector [data-nt-editor]
// marca el elemento editable; los colores y recuadros viven en estilos/editor.css.
export function cssEditor() {
  const R = '[data-nt-editor]';
  const p = BLOQUES.parrafo, L = BLOQUES.vineta;
  const css = [
    `${R}{font-family:${FUENTE_TEXTO};line-height:${p.interlinea};white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;}`,
    `${R} p,${R} div{margin:0 0 ${p.despues}em;}`,
    ...['titulo1', 'titulo2', 'titulo3'].map((t, i) => `${R} h${i + 1}{font-size:${BLOQUES[t].factor}em;line-height:${BLOQUES[t].interlinea};font-weight:700;margin:0 0 ${BLOQUES[t].despues}em;}`),
    `${R} ul,${R} ol{margin:0 0 ${FIN_LISTA}em;padding:0 0 0 ${SANGRIA_LISTA}em;}`,
    `${R} ul ul,${R} ul ol,${R} ol ul,${R} ol ol{margin:0;}`,
    `${R} li{margin:${L.despues}em 0 0;}`,
    `${R}>ul>li:first-child,${R}>ol>li:first-child{margin-top:0;}`,
    // Marcas por profundidad, iguales a las que dibuja el lienzo (•/◦/▪, 1./a./i.)
    `${R} ul{list-style-type:disc;}`, `${R} ul ul,${R} ol ul{list-style-type:circle;}`,
    `${R} ul ul ul,${R} ul ol ul,${R} ol ul ul,${R} ol ol ul{list-style-type:square;}`,
    `${R} ol{list-style-type:decimal;}`, `${R} ul ol,${R} ol ol{list-style-type:lower-alpha;}`,
    `${R} ul ul ol,${R} ul ol ol,${R} ol ul ol,${R} ol ol ol{list-style-type:lower-roman;}`,
    `${R} table{border-collapse:collapse;table-layout:fixed;width:100%;margin:0 0 ${TABLA.despues}em;}`,
    `${R} td,${R} th{border:${TABLA.borde}px solid ${TABLA.colorBorde};padding:${TABLA.padY}em ${TABLA.padX}em;vertical-align:top;font-weight:400;text-align:left;line-height:${p.interlinea};overflow-wrap:break-word;}`,
    `${R} td p,${R} td div,${R} th p,${R} th div{margin:0;}`,
    `${R} table[data-enc="1"] tr:first-child>*{background:${TABLA.colorEncabezado};font-weight:700;}`,
    `${R}>:last-child{margin-bottom:0;}`,
    `${R}[data-nt-guiado="1"]{line-height:var(--nt-paso);}`,
    `${R}[data-nt-guiado="1"] p,${R}[data-nt-guiado="1"] div{line-height:var(--nt-paso);margin:0 0 var(--nt-gap-parrafo);}`,
    ...['titulo1', 'titulo2', 'titulo3'].map((t, i) => `${R}[data-nt-guiado="1"] h${i + 1}{line-height:var(--nt-lh-${i + 1});margin:0 0 var(--nt-gap-titulo-${i + 1});}`),
    `${R}[data-nt-guiado="1"] ul,${R}[data-nt-guiado="1"] ol{margin:0 0 var(--nt-gap-lista);}`,
    `${R}[data-nt-guiado="1"] li{line-height:var(--nt-paso);margin:0;}`,
    `${R}[data-nt-guiado="1"] table{margin:0 0 var(--nt-gap-tabla);}`,
    `${R}[data-nt-guiado="1"] td,${R}[data-nt-guiado="1"] th{line-height:var(--nt-paso);padding:0 ${TABLA.padX}em;}`,
  ];
  return css.join('\n');
}
