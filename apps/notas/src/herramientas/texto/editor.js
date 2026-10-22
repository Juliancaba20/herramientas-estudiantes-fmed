// Editor de texto con teclado (Etapa 6). Es un elemento editable (contenteditable) que se coloca
// encima del lienzo, con la misma posición y escala que tendrá el texto una vez dibujado.
// Usa el teclado, el corrector y la selección nativos del dispositivo (importante en iPad y Android).
// No conoce React ni el motor: avisa lo que pasa con las funciones alCambiar / alTerminar / alPuntoDeControl.
import { mundoAPantalla } from '../../lienzo/camara.js';
import { BLOQUES, ETIQUETA_BLOQUE, FIN_LISTA, NIVEL_MAX, TABLA, TAMANOS_TEXTO, cssEditor } from './estilo.js';
import { domAModelo, htmlAModelo, modeloAHtml, runsAHtml } from './html.js';
import { bloquesDe, colorBaseDe, esVacio, tamanoDe, textoAModelo } from './modelo.js';
import { alternarEncabezado, celdaDe, celdaVecina, colMas, colMenos, cursorAlFinal, filaMas, filaMenos, insertarTabla, quitarTabla } from './tabla.js';

function inyectarEstilo(doc) {
  if (doc.getElementById('nt-estilo-texto')) return;
  const s = doc.createElement('style');
  s.id = 'nt-estilo-texto';
  s.textContent = cssEditor();
  doc.head.appendChild(s);
}

const DIFERIDO = (f) => (typeof queueMicrotask === 'function' ? queueMicrotask(f) : Promise.resolve().then(f));

export class EditorTexto {
  // capa: elemento donde se coloca · el: { x, y, ancho, datos } del elemento que se edita
  constructor(capa, { el, camara, guia = null, alImagen, alCambiar, alTerminar, alPuntoDeControl, alTamano }) {
    this.capa = capa;
    this.doc = capa.ownerDocument;
    this.win = this.doc.defaultView;
    this.el = el;
    this.camara = camara;
    this.guia = el.datos?.composicion === 'guiada' ? guia : null;
    this.alImagen = alImagen || (() => {});
    this.tamano = tamanoDe(el.datos);
    this.colorBase = colorBaseDe(el.datos);
    this.alCambiar = alCambiar || (() => {});
    this.alTerminar = alTerminar || (() => {});
    this.alPuntoDeControl = alPuntoDeControl || (() => {});
    this.alTamano = alTamano || (() => {});
    this.cerrado = false;
    this._rango = null;
    this._estado = null;
    this._control = null;
    inyectarEstilo(this.doc);

    const r = this.raiz = this.doc.createElement('div');
    r.className = 'nt-texto-ed';
    r.setAttribute('data-nt-editor', '');
    r.setAttribute('contenteditable', 'true');
    r.setAttribute('role', 'textbox');
    r.setAttribute('aria-multiline', 'true');
    r.setAttribute('aria-label', 'Texto. Pulse Escape para terminar de escribir.');
    r.setAttribute('lang', 'es');
    r.setAttribute('spellcheck', 'true');
    r.setAttribute('autocapitalize', 'sentences');
    r.style.width = `${el.ancho}px`;
    r.style.fontSize = `${this.tamano}px`;
    r.style.color = this.colorBase;
    r.innerHTML = modeloAHtml(bloquesDe(el.datos), { relleno: true });
    capa.appendChild(r);
    this._aplicarGuia();
    this.posicionar(camara);

    this._on = [
      [r, 'input', () => this._alEntrada()],
      [r, 'keydown', (e) => this._tecla(e)],
      [r, 'paste', (e) => this._pegar(e)],
      [r, 'blur', (e) => this._alPerderFoco(e)],
      [r, 'dragover', (e) => e.preventDefault()],
      [r, 'drop', (e) => this._soltarArchivo(e)],
      [this.doc, 'selectionchange', () => this._alSeleccion()],
    ];
    this._on.forEach(([o, t, f]) => o.addEventListener(t, f));
    this._cmd('defaultParagraphSeparator', 'p');
  }

  // ---------- posición ----------
  posicionar(camara = this.camara) {
    this.camara = camara;
    const p = mundoAPantalla(camara, this.el.x, this.el.y);
    this.raiz.style.transform = `translate(${p.x}px, ${p.y}px) scale(${camara.zoom})`;
  }

  rect() { return this.raiz.getBoundingClientRect(); }

  _aplicarGuia() {
    const paso = this.guia?.interlineado;
    if (!(paso > 0)) { this.raiz.removeAttribute('data-nt-guiado'); return; }
    this.raiz.setAttribute('data-nt-guiado', '1');
    this.raiz.style.setProperty('--nt-paso', `${paso}px`);
    for (const [i, tipo] of ['titulo1', 'titulo2', 'titulo3'].entries()) {
      const def = BLOQUES[tipo], altoNatural = this.tamano * def.factor * def.interlinea;
      this.raiz.style.setProperty(`--nt-lh-${i + 1}`, `${Math.max(paso, Math.ceil(altoNatural / paso) * paso)}px`);
      this.raiz.style.setProperty(`--nt-gap-titulo-${i + 1}`, `${Math.max(0, Math.round((this.tamano * def.factor * def.despues) / paso) * paso)}px`);
    }
    this.raiz.style.setProperty('--nt-gap-parrafo', `${Math.max(0, Math.round((this.tamano * BLOQUES.parrafo.despues) / paso) * paso)}px`);
    this.raiz.style.setProperty('--nt-gap-lista', `${Math.max(0, Math.round((this.tamano * FIN_LISTA) / paso) * paso)}px`);
    this.raiz.style.setProperty('--nt-gap-tabla', `${Math.max(0, Math.round((this.tamano * TABLA.despues) / paso) * paso)}px`);
  }

  // ---------- foco y selección ----------
  enfocar(punto) {
    try { this.raiz.focus({ preventScroll: true }); } catch { this.raiz.focus(); }
    let hecho = false;
    if (punto && typeof punto.x === 'number') {
      try {
        let r = null;
        if (this.doc.caretPositionFromPoint) { const c = this.doc.caretPositionFromPoint(punto.x, punto.y); if (c) { r = this.doc.createRange(); r.setStart(c.offsetNode, c.offset); r.collapse(true); } }
        else if (this.doc.caretRangeFromPoint) r = this.doc.caretRangeFromPoint(punto.x, punto.y);
        if (r && this.raiz.contains(r.startContainer)) { const s = this.win.getSelection(); s.removeAllRanges(); s.addRange(r); hecho = true; }
      } catch { /* se deja el cursor al final */ }
    }
    if (!hecho) { const ult = this.raiz.lastElementChild; if (ult) cursorAlFinal(this.win, ult); }
    this._guardarSeleccion();
    this._refrescar();
  }

  insertarTextoDirecto(texto) {
    this._restaurarSeleccion();
    if (this._cmd('insertText', texto)) { this._guardarSeleccion(); this._alEntrada(); return true; }
    const s = this.win.getSelection();
    if (!s?.rangeCount) return false;
    const rango = s.getRangeAt(0);
    if (!this.raiz.contains(rango.startContainer)) return false;
    rango.deleteContents();
    const nodo = this.doc.createTextNode(texto);
    rango.insertNode(nodo);
    rango.setStartAfter(nodo); rango.collapse(true);
    s.removeAllRanges(); s.addRange(rango);
    this._alEntrada();
    return true;
  }

  puntoInsercion() {
    const s = this.win.getSelection();
    if (!s?.rangeCount || !this.raiz.contains(s.anchorNode)) return null;
    const rango = s.getRangeAt(0).cloneRange();
    rango.collapse(true);
    const r = rango.getBoundingClientRect?.();
    if (r && Number.isFinite(r.left) && (r.height || r.width)) return { x: r.left, y: r.bottom || r.top };
    const caja = this.rect();
    if (caja && (caja.height || caja.width)) return { x: caja.left, y: caja.bottom };
    return null;
  }

  _dentro() { const s = this.win.getSelection(); return !!(s && s.rangeCount && this.raiz.contains(s.anchorNode)); }
  _guardarSeleccion() { const s = this.win.getSelection(); if (s && s.rangeCount && this.raiz.contains(s.anchorNode)) this._rango = s.getRangeAt(0).cloneRange(); }
  _restaurarSeleccion() {
    if (!this._dentro() && this._rango) { const s = this.win.getSelection(); s.removeAllRanges(); s.addRange(this._rango); }
    if (this.doc.activeElement !== this.raiz) { try { this.raiz.focus({ preventScroll: true }); } catch { /* sin foco */ } }
  }

  _alSeleccion() { if (this.cerrado || !this._dentro()) return; this._guardarSeleccion(); this._refrescar(); }

  _alPerderFoco(e) {
    if (this.cerrado) return;
    const r = e.relatedTarget;
    if (r && r.closest && r.closest('[data-nt-barra],[data-nt-barra-panel]')) return;
    DIFERIDO(() => { if (!this.cerrado && this.doc.activeElement !== this.raiz) this.alTerminar('blur'); });
  }

  // ---------- eventos ----------
  _alEntrada() {
    this._refrescar();
    clearTimeout(this._control);
    this._control = setTimeout(() => this.alPuntoDeControl(), 450);
  }

  _tecla(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { e.preventDefault(); this.alTerminar('esc'); return; }
    if (e.key === 'Tab') { e.preventDefault(); this._tab(e.shiftKey); return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); this.alTerminar('esc'); return; }
    if (mod && e.shiftKey && !e.altKey) {
      const acc = { KeyX: ['tachado'], Digit7: ['lista', 'numero'], Digit8: ['lista', 'vineta'], KeyL: ['alinear', 'izquierda'], KeyE: ['alinear', 'centro'], KeyR: ['alinear', 'derecha'], Digit0: ['bloque', 'parrafo'], Digit1: ['bloque', 'titulo1'], Digit2: ['bloque', 'titulo2'], Digit3: ['bloque', 'titulo3'] }[e.code];
      if (acc) { e.preventDefault(); this.aplicar(acc[0], acc[1]); }
    }
  }

  _tab(atras) {
    const est = this.estado();
    if (est.enTabla) { const td = this._celda(); if (td) celdaVecina(this.win, td, atras); }
    else if (est.lista) {
      if (atras) this._cmd('outdent');
      else if (est.nivel < NIVEL_MAX) this._cmd('indent');
    }
    this._alEntrada();
  }

  _pegar(e) {
    const dt = e.clipboardData;
    if (!dt) return;
    const archivo = [...(dt.items || [])].filter((item) => item.kind === 'file' && /^image\/(jpeg|png|webp)$/i.test(item.type)).map((item) => item.getAsFile()).find(Boolean);
    if (archivo) { e.preventDefault(); e.stopPropagation(); this.alImagen(archivo, this.puntoInsercion()); return; }
    e.preventDefault();
    const html = dt.getData('text/html');
    let bloques = html && html.trim() ? htmlAModelo(html, { colorBase: this.colorBase }) : [];
    if (esVacio(bloques)) bloques = textoAModelo(dt.getData('text/plain'));
    if (esVacio(bloques)) return;
    this.insertarBloques(bloques);
  }

  _soltarArchivo(e) {
    const archivo = [...(e.dataTransfer?.files || [])].find((f) => /^image\/(jpeg|png|webp)$/i.test(f.type));
    if (!archivo) { e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation();
    this.alImagen(archivo, { x: e.clientX, y: e.clientY });
  }

  // Un solo párrafo se inserta en línea (dentro de la frase); varios bloques, tal cual.
  insertarBloques(bloques) {
    this._restaurarSeleccion();
    const simple = bloques.length === 1 && bloques[0].tipo === 'parrafo';
    const html = simple ? runsAHtml(bloques[0].runs) : modeloAHtml(bloques);
    let ok = false;
    try { ok = this.doc.execCommand('insertHTML', false, html); } catch { ok = false; }
    if (!ok) {
      const s = this.win.getSelection();
      if (s && s.rangeCount) {
        const r = s.getRangeAt(0);
        r.deleteContents();
        const t = this.doc.createElement('template');
        t.innerHTML = html;
        r.insertNode(t.content);
        r.collapse(false);
      } else this.raiz.insertAdjacentHTML('beforeend', html);
      this._alEntrada();
    }
  }

  // ---------- comandos ----------
  _cmd(nombre, valor = null) {
    try { return !!this.doc.execCommand(nombre, false, valor); } catch { return false; }
  }

  _celda() { const s = this.win.getSelection(); return celdaDe(s && s.rangeCount && this._dentro() ? s.anchorNode : this._rango && this._rango.startContainer, this.raiz); }

  deshacer() { this._restaurarSeleccion(); this._cmd('undo'); this._refrescar(); }
  rehacer() { this._restaurarSeleccion(); this._cmd('redo'); this._refrescar(); }

  aplicar(accion, valor) {
    this._restaurarSeleccion();
    this._cmd('styleWithCSS', true);
    const est = this.estado();
    const sinBloques = est.enTabla; // en celdas solo hay formato de letra
    switch (accion) {
      case 'negrita': this._cmd('bold'); break;
      case 'cursiva': this._cmd('italic'); break;
      case 'subrayado': this._cmd('underline'); break;
      case 'tachado': this._cmd('strikeThrough'); break;
      case 'color': this._cmd('foreColor', valor || this.colorBase); break;
      case 'resaltado': if (!this._cmd('hiliteColor', valor || 'transparent')) this._cmd('backColor', valor || 'transparent'); break;
      case 'bloque': {
        if (sinBloques) break;
        if (est.lista) this._cmd(est.lista === 'numero' ? 'insertOrderedList' : 'insertUnorderedList');
        this._cmd('formatBlock', valor === est.bloque && valor !== 'parrafo' ? 'p' : ETIQUETA_BLOQUE[valor] || 'p');
        break;
      }
      case 'lista': {
        if (sinBloques) break;
        if (est.bloque !== 'parrafo') this._cmd('formatBlock', 'p');
        this._cmd(valor === 'numero' ? 'insertOrderedList' : 'insertUnorderedList');
        break;
      }
      case 'sangria':
        if (!est.lista) break;
        if (valor === 'menos') this._cmd('outdent'); else if (est.nivel < NIVEL_MAX) this._cmd('indent');
        break;
      case 'alinear':
        if (sinBloques) break;
        this._cmd({ izquierda: 'justifyLeft', centro: 'justifyCenter', derecha: 'justifyRight' }[valor] || 'justifyLeft');
        break;
      case 'tamano': this._fijarTamano(valor); break;
      case 'tabla': this._tabla(valor); break;
      default: break;
    }
    this._alEntrada();
  }

  _fijarTamano(v) {
    let n = this.tamano;
    if (v === 'mas') n = TAMANOS_TEXTO.find((t) => t > n + 0.01) ?? n;
    else if (v === 'menos') n = [...TAMANOS_TEXTO].reverse().find((t) => t < n - 0.01) ?? n;
    else if (v > 0) n = Math.round(v);
    if (n === this.tamano) return;
    this.tamano = n;
    this.raiz.style.fontSize = `${n}px`;
    this._aplicarGuia();
    this.alTamano(n);
  }

  _tabla(op) {
    const td = this._celda();
    switch (op) {
      case 'insertar': if (!td) insertarTabla(this.win, this.raiz, 3, 3); break;
      case 'fila+': if (td) filaMas(this.win, td, true); break;
      case 'fila-': if (td) filaMenos(this.win, this.raiz, td); break;
      case 'col+': if (td) colMas(this.win, td, true); break;
      case 'col-': if (td) colMenos(this.win, this.raiz, td); break;
      case 'borrar': if (td) quitarTabla(this.win, this.raiz, td); break;
      case 'encabezado': if (td) alternarEncabezado(td); break;
      default: break;
    }
    this._guardarSeleccion();
  }

  // ---------- estado para la barra ----------
  _consulta(cmd) { try { return !!this.doc.queryCommandState(cmd); } catch { return false; } }

  estado() {
    const s = this.win.getSelection();
    let nodo = s && s.rangeCount && this._dentro() ? s.anchorNode : this._rango && this._rango.startContainer;
    if (!nodo || !this.raiz.contains(nodo)) nodo = this.raiz.firstChild || this.raiz;
    let n = nodo.nodeType === 1 ? nodo : nodo.parentElement;
    let td = null, li = null, enc = null, bloque = null, listas = 0;
    while (n && n !== this.raiz) {
      const t = n.tagName;
      if ((t === 'TD' || t === 'TH') && !td) td = n;
      if (t === 'LI' && !li) li = n;
      if (/^H[1-6]$/.test(t) && !enc) enc = n;
      if ((t === 'UL' || t === 'OL')) listas++;
      if (!bloque && /^(P|DIV|H[1-6]|LI)$/.test(t)) bloque = n;
      n = n.parentElement;
    }
    let alinear = 'izquierda';
    if (bloque) {
      const a = (bloque.style && bloque.style.textAlign) || '';
      alinear = a === 'center' ? 'centro' : a === 'right' || a === 'end' ? 'derecha' : 'izquierda';
    }
    const tabla = td && td.closest('table');
    const lista = li ? (li.parentElement && li.parentElement.tagName === 'OL' ? 'numero' : 'vineta') : null;
    return {
      activo: true,
      negrita: this._consulta('bold') && !enc, cursiva: this._consulta('italic'), subrayado: this._consulta('underline'), tachado: this._consulta('strikeThrough'),
      bloque: enc ? `titulo${Math.min(+enc.tagName[1], 3)}` : 'parrafo',
      lista, nivel: lista ? Math.max(0, listas - 1) : 0,
      alinear, tamano: this.tamano,
      enTabla: !!td, encabezado: !!(tabla && tabla.getAttribute('data-enc') === '1'),
    };
  }

  _refrescar() { this._estado = this.estado(); this.alCambiar(this._estado); }
  estadoActual() { return this._estado || (this._estado = this.estado()); }

  // ---------- contenido ----------
  leer() { return domAModelo(this.raiz, { colorBase: this.colorBase }); }

  destruir() {
    if (this.cerrado) return;
    this.cerrado = true;
    clearTimeout(this._control);
    this._on.forEach(([o, t, f]) => o.removeEventListener(t, f));
    this.raiz.remove();
  }
}
