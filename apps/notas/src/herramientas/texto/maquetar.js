// Maquetación del texto enriquecido (Etapa 6): decide dónde corta cada renglón y dónde va cada cosa.
// No dibuja ni toca el DOM: devuelve órdenes de dibujo relativas a la esquina del elemento
//   { alto, fondos: [{x,y,w,h,color}], textos: [{x,y,texto,fuente,color}], lineas: [{x1,y1,x2,y2,grosor,color}] }
// medidor = { ancho(fuente, texto), metricas(fuente) → { asc, desc } }
import { BLOQUES, FIN_LISTA, MARCAS_VINETA, SANGRIA_LISTA, TABLA, fuente } from './estilo.js';
import { bloquesDe, colorBaseDe, colorSeguro, etiquetaNumero, sanear, tamanoDe } from './modelo.js';

// Texto → unidades que no se parten: palabras (aunque cambien de formato a mitad), espacios y saltos.
function unidades(runs) {
  const us = [];
  let ult = null;
  for (const run of runs) {
    run.texto.split('\n').forEach((parte, i) => {
      if (i > 0) { us.push({ tipo: 'salto' }); ult = null; }
      for (const seg of parte.match(/\s+|\S+/g) || []) {
        const tipo = /^\s/.test(seg) ? 'espacio' : 'palabra';
        if (ult && ult.tipo === tipo) ult.piezas.push({ texto: seg, run });
        else { ult = { tipo, piezas: [{ texto: seg, run }] }; us.push(ult); }
      }
    });
  }
  return us;
}

// Reparte los fragmentos en renglones de ancho máximo `max`. Cada renglón: { frags: [{texto, run, ancho, x, espacio}], x }
function fluir(runs, max, fnt, medidor) {
  const lineas = [];
  let l = { frags: [], x: 0 };
  const cerrar = () => { lineas.push(l); l = { frags: [], x: 0 }; };
  const poner = (texto, run, ancho, espacio) => {
    const u = l.frags[l.frags.length - 1];
    if (u && u.run === run && u.espacio === espacio && u.x + u.ancho === l.x) { u.texto += texto; u.ancho += ancho; }
    else l.frags.push({ texto, run, ancho, x: l.x, espacio });
    l.x += ancho;
  };
  for (const u of unidades(runs)) {
    if (u.tipo === 'salto') { cerrar(); continue; }
    const piezas = u.piezas.map((p) => ({ ...p, ancho: medidor.ancho(fnt(p.run), p.texto) }));
    const w = piezas.reduce((a, p) => a + p.ancho, 0);
    if (u.tipo === 'espacio') { piezas.forEach((p) => poner(p.texto, p.run, p.ancho, true)); continue; } // al final del renglón «cuelgan»
    if (l.x > 0 && l.x + w > max) cerrar();
    if (w <= max) { piezas.forEach((p) => poner(p.texto, p.run, p.ancho, false)); continue; }
    // Palabra más larga que el renglón: se parte por letras
    for (const p of piezas) {
      for (const ch of p.texto) {
        const cw = medidor.ancho(fnt(p.run), ch);
        if (l.x > 0 && l.x + cw > max) cerrar();
        poner(ch, p.run, cw, false);
      }
    }
  }
  cerrar();
  return lineas;
}

const vacioVisible = (f) => f.espacio || /^\s*$/.test(f.texto);

export function maquetar(datos, ancho, medidor, opciones = {}) {
  const tam = tamanoDe(datos);
  const colorBase = colorBaseDe(datos);
  const bloques = sanear(bloquesDe(datos));
  const pasoGuia = datos.composicion === 'guiada' && Number.isFinite(opciones.interlineado) && opciones.interlineado > 0
    ? opciones.interlineado
    : 0;
  const ajustarAlPaso = (altura) => pasoGuia ? Math.max(pasoGuia, Math.ceil((altura - 1e-8) / pasoGuia) * pasoGuia) : altura;
  const ajustarEspacio = (altura) => pasoGuia ? Math.max(0, Math.round(altura / pasoGuia) * pasoGuia) : altura;
  const salida = { ancho, alto: 0, fondos: [], textos: [], lineas: [] };
  const cont = []; // numeración por nivel
  let y = 0;
  let hueco = 0;

  // Pone en `salida` los renglones de un flujo. Devuelve la nueva y.
  function emitir(lineas, { x0, y0, max, alinear, bt, lh, negritaBase }) {
    const regular = fuente({}, bt, negritaBase);
    const m = medidor.metricas(regular);
    let top = y0;
    for (const l of lineas) {
      const base = top + (lh - (m.asc + m.desc)) / 2 + m.asc;
      let fin = -1;
      l.frags.forEach((f, i) => { if (!vacioVisible(f)) fin = i; });
      const ancho = fin >= 0 ? l.frags[fin].x + l.frags[fin].ancho : 0;
      const off = alinear === 'centro' ? Math.max(0, (max - ancho) / 2) : alinear === 'derecha' ? Math.max(0, max - ancho) : 0;
      // Los fragmentos contiguos del mismo formato se dibujan juntos (menos órdenes y mejor espaciado de letras)
      const grupos = [];
      for (let i = 0; i <= fin; i++) {
        const f = l.frags[i], u = grupos[grupos.length - 1];
        if (u && u.run === f.run) { u.texto += f.texto; u.ancho = f.x + f.ancho - u.x; } else grupos.push({ run: f.run, texto: f.texto, x: f.x, ancho: f.ancho });
      }
      for (const g of grupos) {
        const r = g.run, x = x0 + off + g.x;
        const hl = colorSeguro(r.resaltado);
        if (hl) salida.fondos.push({ x, y: base - m.asc, w: g.ancho, h: m.asc + m.desc, color: hl });
        const col = colorSeguro(r.color) || colorBase;
        if (g.texto.trim() !== '') salida.textos.push({ x, y: base, texto: g.texto, fuente: fuente(r, bt, negritaBase), color: col });
        const grosor = Math.max(1, bt / 18);
        if (r.subrayado) salida.lineas.push({ x1: x, x2: x + g.ancho, y1: base + bt * 0.12, y2: base + bt * 0.12, grosor, color: col });
        if (r.tachado) salida.lineas.push({ x1: x, x2: x + g.ancho, y1: base - bt * 0.28, y2: base - bt * 0.28, grosor, color: col });
      }
      top += lh;
    }
    return top;
  }

  bloques.forEach((b, i) => {
    const sig = bloques[i + 1];
    if (b.tipo === 'tabla') {
      cont.length = 0;
      const ncol = b.filas[0].length;
      const cw = ancho / ncol, px = TABLA.padX * tam, py = pasoGuia ? 0 : TABLA.padY * tam, lh = pasoGuia || tam * BLOQUES.parrafo.interlinea;
      const celdas = [];
      const alturas = b.filas.map((fila, r) => {
        const enc = b.encabezado && r === 0;
        let h = 0;
        fila.forEach((cel, c) => {
          const ls = fluir(cel.runs, Math.max(1, cw - 2 * px - TABLA.borde), (run) => fuente(run, tam, enc), medidor);
          celdas.push({ r, c, ls, enc });
          h = Math.max(h, ls.length * lh);
        });
        return ajustarAlPaso(h + 2 * py + TABLA.borde);
      });
      const tops = [y];
      alturas.forEach((h) => tops.push(tops[tops.length - 1] + h));
      if (b.encabezado) salida.fondos.push({ x: 0, y, w: ancho, h: alturas[0], color: TABLA.colorEncabezado });
      const lin = (x1, y1, x2, y2) => salida.lineas.push({ x1, y1, x2, y2, grosor: TABLA.borde, color: TABLA.colorBorde });
      tops.forEach((t) => lin(0, t + 0.5, ancho, t + 0.5));
      for (let c = 0; c <= ncol; c++) { const x = c === 0 ? 0.5 : c === ncol ? ancho - 0.5 : c * cw; lin(x, y, x, tops[tops.length - 1] + TABLA.borde); }
      for (const { r, c, ls, enc } of celdas) {
        emitir(ls, { x0: c * cw + TABLA.borde / 2 + px, y0: tops[r] + TABLA.borde / 2 + py, max: cw - 2 * px - TABLA.borde, alinear: 'izquierda', bt: tam, lh, negritaBase: enc });
      }
      y = ajustarAlPaso(tops[tops.length - 1] + TABLA.borde);
      hueco = ajustarEspacio(TABLA.despues * tam);
      y += hueco;
      return;
    }
    const def = BLOQUES[b.tipo];
    const bt = tam * def.factor, lh = ajustarAlPaso(bt * def.interlinea);
    let x0 = 0;
    if (def.lista) {
      cont.length = b.nivel + 1;
      x0 = (b.nivel + 1) * SANGRIA_LISTA * tam;
    } else cont.length = 0;
    const lineas = fluir(b.runs, Math.max(1, ancho - x0), (run) => fuente(run, bt, def.negrita), medidor);
    if (def.lista) {
      let marca;
      if (b.tipo === 'numero') {
        cont[b.nivel] = (b.inicio && b.inicio > 0) ? b.inicio : (cont[b.nivel] || 0) + 1;
        marca = etiquetaNumero(cont[b.nivel], b.nivel);
      }
      else { cont[b.nivel] = 0; marca = MARCAS_VINETA[b.nivel]; }
      const fm = fuente({}, bt, false);
      const mm = medidor.metricas(fm);
      const base = y + (lh - (mm.asc + mm.desc)) / 2 + mm.asc;
      salida.textos.push({ x: x0 - 0.4 * bt - medidor.ancho(fm, marca), y: base, texto: marca, fuente: fm, color: colorBase });
    }
    y = emitir(lineas, { x0, y0: y, max: Math.max(1, ancho - x0), alinear: b.alinear, bt, lh, negritaBase: def.negrita });
    const siguienteEnLista = sig && sig.tipo !== 'tabla' && BLOQUES[sig.tipo].lista && (sig.nivel > 0 || b.nivel > 0 || sig.tipo === b.tipo);
    hueco = ajustarEspacio((def.lista ? (siguienteEnLista ? def.despues : FIN_LISTA) : def.despues) * bt);
    y += hueco;
  });

  if (bloques.length) y -= hueco;
  salida.alto = bloques.length ? y : tam * BLOQUES.parrafo.interlinea;
  return salida;
}
