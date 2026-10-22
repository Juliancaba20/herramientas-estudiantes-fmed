import { crearElemento, nuevoId, TIPOS_ELEMENTO } from '../almacen/modelo.js';
import { guardarBlob } from '../almacen/blobs.js';
import { camaraInicial, encuadrar, mover, mundoAPantalla, pantallaAMundo, zoomEn } from './camara.js';
import { dibujar } from './dibujo.js';
import { invertir } from './historial.js';
import {
  CURSOR_MANIJA, FORMAS, borrarZona, cajaDeTrazo, esLinea, esRedimensionable, lineaDesdeExtremos, manijaEn, manijas, moverExtremo, normalizarRect, puntoEnElemento, puntoEnTrazo,
  rectsSeCruzan, redimensionar, simplificar, trasladar,
} from './geometria.js';
import { Minimapa } from './minimapa.js';
import { alinearPunto, destelloVigente, guiaActiva, normalizarRenglones, opacidadRenglones } from './renglones.js';
import { EditorTexto } from '../herramientas/texto/editor.js';
import { baseDelPrimerRenglon, invalidarMetricas, layoutDe } from '../herramientas/texto/pintar.js';
import { bloquesDe, datosTextoNuevo, esVacio, modeloATexto, textoAModelo } from '../herramientas/texto/modelo.js';
import { htmlAModelo, modeloAHtml } from '../herramientas/texto/html.js';
import { COLOR_TEXTO } from '../herramientas/texto/estilo.js';
import { procesarImagen } from '../herramientas/imagenes/procesar.js';
import { liberarImagenesCanvas } from '../herramientas/imagenes/recursos.js';
import { recorteImagenSeguro } from './dibujo.js';

const PALETA = ['#cfdcff', '#ffe9a8', '#c9f0d8', '#ffd3dc', '#e3d6ff', '#d4eef7'];
const BORDES = ['#2350d8', '#b8860b', '#1f7a45', '#c2315a', '#6a3fc2', '#1b7a99'];

export const AJUSTES_INICIALES = {
  lapiz: { color: '#14192b', grosor: 3, opacidad: 1 },
  resaltador: { color: '#ffd84d', grosor: 18, opacidad: 0.4 },
  borrador: { modo: 'trazo', tamano: 28 }, // modo: 'trazo' (trazo completo) | 'zona'
  // Grosores y tamaños están en unidades del mundo: lo que se crea sale igual con cualquier zoom (al acercar se ve más grande).
  texto: { tamano: 20 },
  figura: { borde: '#2350d8', relleno: null, grosor: 3 }, // estilo de las figuras nuevas
  vista: { minimapa: true },
};
const HERRAMIENTAS_DE_MANO = ['lapiz', 'resaltador', 'borrador'];

// Motor del lienzo: cámara, selección, gestos (mouse, dedo, pellizco) e historial.
// No conoce React: la interfaz lo maneja con sus métodos y escucha `alCambiar` / `alCamara`.
export class Lienzo {
  constructor(canvas, { escena, camara, documentoId = '', ajustes, alCambiar, alCamara, alAjustes, alImagenError, capaTexto, escritura = 'ambos', renglones, alRenglones, contenedor = null, marco = null }) {
    this.canvas = canvas;
    this.documentoId = documentoId;
    this.contenedor = contenedor;
    this.marco = marco; // marco delimitador del documento (por ejemplo, tarjetas o páginas)
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); // desynchronized: menor latencia donde el navegador lo permite
    this.escena = escena;
    this.camara = camara || camaraInicial();
    this.alCambiar = alCambiar || (() => {});
    this.alCamara = alCamara || (() => {});
    this.alAjustes = alAjustes || (() => {});
    this.alImagenError = alImagenError || (() => {});
    this.ajustes = {
      lapiz: { ...AJUSTES_INICIALES.lapiz, ...ajustes?.lapiz },
      resaltador: { ...AJUSTES_INICIALES.resaltador, ...ajustes?.resaltador },
      borrador: { ...AJUSTES_INICIALES.borrador, ...ajustes?.borrador },
      texto: { ...AJUSTES_INICIALES.texto, ...ajustes?.texto },
      figura: { ...AJUSTES_INICIALES.figura, ...ajustes?.figura },
      vista: { ...AJUSTES_INICIALES.vista, ...ajustes?.vista },
    };
    this.minimapa = null;
    this.msDibujo = 0;
    this.renglones = normalizarRenglones(renglones); // guía de fondo del documento (Etapa 8)
    this.alRenglones = alRenglones || (() => {});
    this._destello = null; // aparición temporal de los renglones: { inicio, duracion }
    this.escritura = escritura; // ambos | mano | teclado: qué herramientas ofrece el documento
    this.capaTexto = capaTexto || canvas.parentElement;
    this.editor = null; // editor de texto activo (Etapa 6)
    this.texto = null; // { id, base, original, nuevo } de la sesión de edición
    this.ocultoId = null;
    this._ultimoToque = null;
    this._ultimoToqueVacio = null;
    this.cursorTexto = null;
    this.herramienta = 'seleccionar'; // seleccionar | mano | lapiz | resaltador | borrador | rectangulo | elipse
    this.dedoDibuja = true; // pasa a false al detectar un lápiz: entonces el dedo mueve el lienzo
    this.hayLapiz = false;
    this._dedoManual = false;
    this.ignorados = new Set(); // punteros descartados (palma)
    this.cursor = null;
    this._cache = null;
    this.seleccion = new Set();
    this._recorteEnCurso = null;
    this.punteros = new Map();
    this.gesto = null;
    this.pellizco = null;
    this.espacio = false;
    this.ancho = 1; this.alto = 1; this.dpr = 1;
    this.dibujados = 0;
    this._ui = '';
    this._pendiente = false;
    this._contadorFigura = 0;

    this._eventos = [
      [canvas, 'pointerdown', (e) => this._abajo(e)],
      [canvas, 'pointermove', (e) => this._mover(e)],
      [canvas, 'pointerup', (e) => this._arriba(e)],
      [canvas, 'pointercancel', (e) => this._cancelado(e)],
      [canvas, 'wheel', (e) => this._rueda(e), { passive: false }],
      [canvas, 'dragover', (e) => this._arrastrarArchivo(e)],
      [canvas, 'drop', (e) => this._soltarArchivo(e)],
      [canvas, 'pointerleave', () => { this.cursor = null; this.pedirDibujo(); }],
      [canvas, 'contextmenu', (e) => e.preventDefault()],
      [canvas, 'touchstart', (e) => e.preventDefault(), { passive: false }], // bloquea desplazamiento y zoom de la página
      [canvas, 'touchmove', (e) => e.preventDefault(), { passive: false }],
      [canvas, 'gesturestart', (e) => e.preventDefault()], // Safari: evita el zoom de la página
      [canvas, 'gesturechange', (e) => e.preventDefault()],
      [window, 'keydown', (e) => this._tecla(e)],
      [window, 'keyup', (e) => this._teclaArriba(e)],
      [window, 'blur', () => { this.espacio = false; this._cursor(); }],
      [window, 'pagehide', () => { this.finalizarGestoEnCurso(); this.puntoDeControlTexto(); }],
      [typeof document !== 'undefined' ? document : window, 'visibilitychange', () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.finalizarGestoEnCurso();
          this.puntoDeControlTexto();
        }
      }],
      [window, 'paste', (e) => this._pegar(e)],
      [window, 'copy', (e) => this._copiar(e)],
    ];
    this._eventos.forEach(([o, t, f, op]) => o.addEventListener(t, f, op));
    this._desuscribir = escena.suscribir(() => { this._limpiarSeleccion(); this.pedirDibujo(); this._notificar(); });
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.redimensionarCanvas());
      this._ro.observe(canvas.parentElement || canvas);
    }
    this.redimensionarCanvas();
    this.cursorTexto = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    this._cursor();
    this._fuentes = () => { invalidarMetricas(); this.refrescarTextos(); this.pedirDibujo(); };
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.addEventListener?.('loadingdone', this._fuentes);
      document.fonts.ready?.then(() => { if (!this._destruido) this._fuentes(); });
    }
  }

  destruir() {
    this.finalizarGestoEnCurso();
    this.cerrarTexto();
    if (typeof document !== 'undefined') document.fonts?.removeEventListener?.('loadingdone', this._fuentes);
    this._quitarVisualViewport();
    this.minimapa?.destruir();
    this._eventos.forEach(([o, t, f, op]) => o.removeEventListener(t, f, op));
    liberarImagenesCanvas(this.canvas);
    this._desuscribir();
    this._ro?.disconnect();
    this._destruido = true;
  }

  // ---------- tamaño y dibujo ----------
  redimensionarCanvas() {
    const r = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.ancho = Math.max(1, Math.floor(r.width));
    this.alto = Math.max(1, Math.floor(r.height));
    this.canvas.width = Math.floor(this.ancho * this.dpr);
    this.canvas.height = Math.floor(this.alto * this.dpr);
    this.pedirDibujo();
  }

  pedirDibujo() {
    if (this._pendiente || this._destruido) return;
    this._pendiente = true;
    requestAnimationFrame(() => this._dibujar());
  }

  setContenedor(c) { this.contenedor = c; }
  _obtenerContenedor(y = null) {
    if (typeof this.contenedor === 'function') {
      return this.contenedor(y != null ? y : (this.camara.y + this.alto / (2 * (this.camara.zoom || 1))));
    }
    return this.contenedor;
  }
  setMarco(m) { this.marco = m; this.pedirDibujo(); }

  _dibujar() {
    this._pendiente = false;
    if (this._destruido) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const unico = this._unicoRedimensionable();
    const g = this.gesto;
    const activo = g && g.tipo === 'dibujar' ? { puntos: g.puntos, color: g.color, grosor: g.grosor, opacidad: g.opacidad, variable: g.variable } : null;
    const res = dibujar(this.ctx, {
      trazoActivo: activo, fondoCache: activo ? this._cache : null, dibujadosPrevio: this.dibujados,
      borrador: this.herramienta === 'borrador' && this.cursor ? { x: this.cursor.x, y: this.cursor.y, r: this.ajustes.borrador.tamano / 2 } : null,
      camara: this.camara, ancho: this.ancho, alto: this.alto, dpr: this.dpr,
      lista: this.escena.lista(), escena: this.escena, seleccion: this.seleccion, ocultoId: this.ocultoId, renglones: this._fondoRenglones(),
      guiaTexto: this.renglones,
      alImagenLista: () => this.pedirDibujo(),
      marco: g && (g.tipo === 'marco' || g.tipo === 'texto') ? normalizarRect(g.inicio.x, g.inicio.y, g.actual.x, g.actual.y) : null,
      mostrarManijas: unico && this.herramienta === 'seleccionar' && (!g || g.tipo === 'redimensionar') ? unico : null,
      marcoDocumento: this.marco,
    });
    if (typeof performance !== 'undefined') this.msDibujo = performance.now() - t0;
    if (this._destello) { if (destelloVigente(this._destello, this._ahora())) this.pedirDibujo(); else this._destello = null; } // sigue la animación
    if (!activo) this.minimapa?.pintar();
    if (res.dibujados !== this.dibujados) { this.dibujados = res.dibujados; this._notificar(); }
  }

  // ¿Hay algo del contenido a la vista? (para ofrecer «Volver al contenido»)
  _hayContenidoVisible() {
    if (!this.escena.mapa.size) return true;
    const v = { x: this.camara.x, y: this.camara.y, ancho: this.ancho / this.camara.zoom, alto: this.alto / this.camara.zoom };
    for (const el of this.escena.mapa.values()) if (rectsSeCruzan(el, v)) return true;
    return false;
  }

  // Estilo de las figuras para el panel: el de la figura seleccionada o, si no hay, el de las nuevas.
  _estiloFigura() {
    const sel = [...this.seleccion].map((id) => this.escena.get(id)).filter((e) => e && e.tipo === 'figura');
    const f = sel[0];
    const a = this.ajustes.figura;
    return {
      seleccionadas: sel.length,
      linea: f ? esLinea(f) : this.herramienta === 'linea' || this.herramienta === 'flecha',
      borde: f ? f.datos.borde || a.borde : a.borde,
      relleno: f ? f.datos.relleno || null : a.relleno,
      grosor: f ? Math.max(1, Math.min(40, Math.round(f.datos.grosor || 2))) : a.grosor,
    };
  }

  _notificar() {
    this._limpiarSeleccion();
    const unico = this.seleccion.size === 1 ? this.escena.get([...this.seleccion][0]) : null;
    const ui = {
      herramienta: this.herramienta,
      zoom: Math.round(this.camara.zoom * 100),
      puedeDeshacer: this.escena.historial.puedeDeshacer() || !!this.editor || !!this.historialExtra?.puedeDeshacer(),
      puedeRehacer: this.escena.historial.puedeRehacer() || !!this.editor || !!this.historialExtra?.puedeRehacer(),
      texto: this.editor ? this.editor.estadoActual() : null,
      seleccionados: this.seleccion.size,
      textoSeleccionado: unico?.tipo === 'texto'
        ? { id: unico.id, x: unico.x, y: unico.y, ancho: unico.ancho, alto: unico.alto }
        : null,
      imagenSeleccionada: unico?.tipo === 'imagen'
        ? { id: unico.id, recorte: recorteImagenSeguro(unico.datos.recorte), nombre: unico.datos.nombre || 'Imagen' }
        : null,
      elementos: this.escena.mapa.size,
      dibujados: this.dibujados,
      ajustes: this.ajustes,
      dedoDibuja: this.dedoDibuja,
      hayLapiz: this.hayLapiz,
      msDibujo: Math.round(this.msDibujo),
      renglones: this.renglones,
      fueraDeVista: !this._hayContenidoVisible(),
      figura: this._estiloFigura(),
    };
    const clave = JSON.stringify(ui);
    if (clave !== this._ui) { this._ui = clave; this.alCambiar(ui); }
  }

  _limpiarSeleccion() { for (const id of this.seleccion) if (!this.escena.mapa.has(id)) this.seleccion.delete(id); }

  _camaraCambio() { this.editor?.posicionar(this.camara); this.pedirDibujo(); this._notificar(); this.alCamara(this.camara); }

  // ---------- utilidades ----------
  _pos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  _mundo(p) { return pantallaAMundo(this.camara, p.x, p.y); }

  _cursorTextoPosicion() {
    if (this.cursorTexto && Number.isFinite(this.cursorTexto.x) && Number.isFinite(this.cursorTexto.y)) return this.cursorTexto;
    return { x: this.camara.x + this.ancho / (2 * this.camara.zoom), y: this.camara.y + this.alto / (2 * this.camara.zoom) };
  }

  _textoEnOCerca(mundo, tol = 8) {
    const el = this._elementoEn(mundo, tol);
    if (el?.tipo === 'texto') return el;
    const lista = this.escena.lista();
    const margenY = Math.max(36, 48 / this.camara.zoom);
    for (let i = lista.length - 1; i >= 0; i--) {
      const t = lista[i];
      if (t.tipo !== 'texto') continue;
      const xMin = t.x - tol;
      const xMax = t.x + t.ancho + tol;
      const yMin = t.y - tol;
      const yMax = t.y + t.alto + margenY;
      if (mundo.x >= xMin && mundo.x <= xMax && mundo.y >= yMin && mundo.y <= yMax) {
        return t;
      }
    }
    return null;
  }

  // Escribir sin abrir el texto: solo vale cuando hay un único texto seleccionado (se abre y recibe la tecla).
  // Para crear un texto nuevo se hace doble clic en un lugar vacío o se usa la herramienta Texto.
  _escribirDirectoDesdeTeclado(caracter) {
    if (this.editor || this.gesto || !this.puedeHerramienta('texto')) return false;
    const unico = this._unicoTexto();
    if (!unico) return false;
    this.editarTexto(unico.id);
    this.editor?.insertarTextoDirecto(caracter);
    return true;
  }

  _crearTextoDirecto(x, y) {
    const tam = Math.max(6, Math.min(800, Math.round(this.ajustes.texto.tamano)));
    const guiado = this.renglones.activos && this.renglones.estilo !== 'liso';
    const datos = { ...datosTextoNuevo(tam), ...(guiado ? { composicion: 'guiada' } : {}) };
    const ancho = Math.max(80, Math.min(3000, Math.round((this.ancho * 0.8) / this.camara.zoom)));
    let ex = x, ey = y;
    const base = baseDelPrimerRenglon(datos, ancho, this._opcionesLayout(datos));
    if (guiado || guiaActiva(this.renglones)) {
      const cfg = guiado ? { ...this.renglones, alinear: true } : this.renglones;
      const q = alinearPunto(cfg, { x: ex, y: ey + base });
      ey = q.y - base;
      if (cfg.estilo !== 'rayado') ex = q.x;
    }
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TEXTO, {
      x: ex, y: ey, ancho, alto: layoutDe(datos, ancho, undefined, this._opcionesLayout(datos)).alto,
      z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(ey), datos,
    });
    this._abrirEditor(el, true, undefined, true);
  }

  _unicoRedimensionable() {
    if (this.seleccion.size !== 1) return null;
    const el = this.escena.get([...this.seleccion][0]);
    return el && esRedimensionable(el) ? el : null;
  }

  _elementoEn(mundo, tol) {
    const lista = this.escena.lista();
    for (let i = lista.length - 1; i >= 0; i--) if (puntoEnElemento(lista[i], mundo.x, mundo.y, tol)) return lista[i];
    return null;
  }

  _cursor(sobre) {
    let c = 'default';
    if (this.pellizco || (this.gesto && this.gesto.tipo === 'paneo')) c = 'grabbing';
    else if (this.herramienta === 'mano' || this.espacio) c = 'grab';
    else if (this.herramienta === 'borrador') c = 'none';
    else if (this.herramienta === 'texto') c = 'text';
    else if (HERRAMIENTAS_DE_MANO.includes(this.herramienta) || FORMAS.includes(this.herramienta)) c = 'crosshair';
    else if (sobre) c = sobre;
    this.canvas.style.cursor = c;
  }

  // ---------- punteros ----------
  _abajo(e) {
    if (e.pointerType === 'mouse' && e.button === 2) return;
    if (e.pointerType === 'pen') this._detectarLapiz();
    // Rechazo de palma: mientras el lápiz escribe, los toques se descartan; y si el lápiz llega
    // con la mano ya apoyada, se descartan los toques en curso.
    if (e.pointerType === 'touch' && ((this.gesto && this.gesto.pointerType === 'pen') || e.width > 40 || e.height > 40)) { this.ignorados.add(e.pointerId); return; }
    if (e.pointerType === 'pen') {
      for (const [id, pt] of [...this.punteros]) if (pt.tipo === 'touch') { this.ignorados.add(id); this.punteros.delete(id); }
      this.pellizco = null;
      if (this.gesto && this.gesto.pointerType === 'touch') this._cancelarGesto();
    }
    this.cerrarTexto(); // tocar el lienzo termina la edición del texto
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* el puntero ya no está activo */ }
    this.canvas.focus?.({ preventScroll: true });
    const p = this._pos(e);
    if (e.pointerType !== 'pen' || !HERRAMIENTAS_DE_MANO.includes(this.herramienta)) this.cursorTexto = this._mundo(p);
    this.punteros.set(e.pointerId, { ...p, tipo: e.pointerType });
    if (this.punteros.size === 2) {
      this._cancelarGesto();
      const [a, b] = [...this.punteros.values()];
      this.pellizco = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, centro: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      this._cursor();
      return;
    }
    if (this.punteros.size > 2) return;
    e.preventDefault?.();
    const mundo = this._mundo(p);
    const tactil = e.pointerType !== 'mouse';
    const manoLibre = HERRAMIENTAS_DE_MANO.includes(this.herramienta);
    const dedoMueve = tactil && e.pointerType === 'touch' && manoLibre && !this.dedoDibuja;
    if ((e.pointerType === 'mouse' && e.button === 1) || this.herramienta === 'mano' || this.espacio || dedoMueve) {
      this.gesto = { tipo: 'paneo', ultimo: p, pointerId: e.pointerId, pointerType: e.pointerType };
      this._cursor();
      return;
    }
    if (this.herramienta === 'seleccionar') this._abajoSeleccion(e, p, mundo, tactil);
    else if (this.herramienta === 'borrador') this._iniciarBorrar(e, p, mundo);
    else if (this.herramienta === 'texto') this.gesto = { tipo: 'texto', pointerId: e.pointerId, pointerType: e.pointerType, inicio: mundo, actual: mundo, inicioPantalla: p };
    else if (manoLibre) this._iniciarTrazo(e, p, mundo);
    else this._iniciarCrear(this._snapPunto(mundo), p);
  }

  _abajoSeleccion(e, p, mundo, tactil) {
    const z = this.camara.zoom;
    const unico = this._unicoRedimensionable();
    if (unico) {
      const m = manijaEn(unico, mundo.x, mundo.y, (tactil ? 22 : 9) / z);
      if (m) { this.gesto = { tipo: 'redimensionar', manija: m, original: unico, inicio: mundo }; return; }
    }
    const el = this._elementoEn(mundo, (tactil ? 8 : 3) / z);
    if (el) {
      if (e.shiftKey) { if (this.seleccion.has(el.id)) this.seleccion.delete(el.id); else this.seleccion.add(el.id); }
      else if (!this.seleccion.has(el.id)) this.seleccion = new Set([el.id]);
      if (this.seleccion.has(el.id)) {
        const origenes = new Map([...this.seleccion].map((id) => [id, this.escena.get(id)]));
        this.gesto = { tipo: 'mover', origenes, inicio: mundo, inicioPantalla: p, movido: false, sobreTexto: el.tipo === 'texto' ? el.id : null };
      }
    } else {
      if (!e.shiftKey) this.seleccion = new Set();
      // Segundo toque seguido en un lugar vacío: al soltar se crea un texto ahí (doble clic o doble toque)
      const u = this._ultimoToqueVacio, ahora = Date.now();
      const doble = !e.shiftKey && u && ahora - u.t < 450 && Math.hypot(p.x - u.x, p.y - u.y) < 14 && this.puedeHerramienta('texto');
      this._ultimoToqueVacio = doble ? null : { t: ahora, x: p.x, y: p.y };
      this.gesto = { tipo: 'marco', inicio: mundo, actual: mundo, base: new Set(this.seleccion), dobleVacio: !!doble, inicioPantalla: p };
    }
    this._notificar(); this.pedirDibujo();
  }

  _detectarLapiz() {
    if (this.hayLapiz) return;
    this.hayLapiz = true;
    if (!this._dedoManual) this.dedoDibuja = false;
    this._notificar();
  }

  _presion(e) { return e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5; }

  _crearCache() {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const cx = c.getContext('2d');
    if (!cx) return null;
    dibujar(cx, { camara: this.camara, ancho: this.ancho, alto: this.alto, dpr: this.dpr, lista: this.escena.lista(), escena: this.escena, seleccion: new Set(), marco: null, mostrarManijas: null, renglones: this._fondoRenglones(), guiaTexto: this.renglones, marcoDocumento: this.marco });
    return c;
  }

  _iniciarTrazo(e, p, mundo) {
    const h = this.herramienta, a = this.ajustes[h];
    this.seleccion = new Set();
    const grosor = a.grosor; // en unidades del mundo: igual con cualquier zoom
    this.gesto = {
      tipo: 'dibujar', pointerId: e.pointerId, pointerType: e.pointerType, herramienta: h, ultimo: p,
      puntos: [[mundo.x, mundo.y, this._presion(e)]],
      variable: e.pointerType === 'pen' && h === 'lapiz' && a.opacidad >= 1,
      grosor, color: a.color, opacidad: a.opacidad,
    };
    this._cache = this._crearCache();
    this._notificar(); this.pedirDibujo();
  }

  _iniciarBorrar(e, p, mundo) {
    this.seleccion = new Set();
    this.gesto = { tipo: 'borrar', pointerId: e.pointerId, pointerType: e.pointerType, cambios: [], ultimo: mundo };
    this.cursor = p;
    this._borrarEn(mundo.x, mundo.y, this.gesto);
    this._notificar(); this.pedirDibujo();
  }

  // Borra (o recorta) los trazos que toca el círculo del borrador en (x, y).
  _borrarEn(x, y, g) {
    const a = this.ajustes.borrador, r = a.tamano / 2 / this.camara.zoom;
    const caja = { x: x - r, y: y - r, ancho: 2 * r, alto: 2 * r };
    const cambios = [];
    for (const el of this.escena.lista()) {
      if (el.tipo !== 'trazo' || !rectsSeCruzan(el, caja)) continue;
      if (a.modo === 'trazo') {
        if (puntoEnTrazo(el, x, y, r)) cambios.push({ id: el.id, antes: el, despues: null });
      } else {
        const tramos = borrarZona(el.datos.puntos, x, y, r + el.datos.grosor / 2);
        if (!tramos) continue;
        cambios.push({ id: el.id, antes: el, despues: null });
        for (const tramo of tramos) {
          if (tramo.length < 2) continue;
          const pts = simplificar(tramo, 0.2 / this.camara.zoom);
          cambios.push({ id: nuevoId(), antes: null, despues: { ...el, id: null, ...cajaDeTrazo(pts, el.datos.grosor), contenedor: this._obtenerContenedor(el.y), datos: { ...el.datos, puntos: pts } } });
        }
      }
    }
    for (const c of cambios) if (c.despues && c.despues.id === null) c.despues.id = c.id;
    if (cambios.length) { this.escena.transitorio(cambios); g.cambios.push(...cambios); }
  }

  _iniciarCrear(mundo) {
    const a = this.ajustes.figura;
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.FIGURA, {
      x: mundo.x, y: mundo.y, ancho: 0, alto: 0, z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(mundo.y),
      datos: { forma: this.herramienta, relleno: this.herramienta === 'linea' || this.herramienta === 'flecha' ? null : a.relleno, borde: a.borde, grosor: Math.max(0.5, a.grosor) },
    });
    this.gesto = { tipo: 'crear', inicio: mundo, elemento: el, actual: null };
  }

  _mover(e) {
    if (this.ignorados.has(e.pointerId)) return;
    const p = this._pos(e);
    if (e.pointerType === 'pen') this._detectarLapiz();
    if (this.herramienta === 'borrador' && e.pointerType !== 'touch') { this.cursor = p; this.pedirDibujo(); }
    if (!this.punteros.has(e.pointerId)) { if (e.pointerType === 'mouse') this._hover(p); return; }
    this.punteros.set(e.pointerId, { ...p, tipo: e.pointerType });
    if (this.punteros.size === 2 && this.pellizco) {
      const [a, b] = [...this.punteros.values()];
      const centro = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      let c = mover(this.camara, centro.x - this.pellizco.centro.x, centro.y - this.pellizco.centro.y);
      c = zoomEn(c, centro.x, centro.y, dist / this.pellizco.dist);
      this.camara = c;
      this.pellizco = { dist, centro };
      this._camaraCambio();
      return;
    }
    const g = this.gesto;
    if (!g) return;
    if (g.pointerId !== undefined && g.pointerId !== e.pointerId) return;
    const mundo = this._mundo(p);
    if (g.tipo === 'dibujar') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        const pp = this._pos(ev);
        if (Math.hypot(pp.x - g.ultimo.x, pp.y - g.ultimo.y) < 1) continue;
        const m = this._mundo(pp);
        g.puntos.push([m.x, m.y, this._presion(ev)]);
        g.ultimo = pp;
      }
      this.pedirDibujo();
    } else if (g.tipo === 'borrar') {
      this.cursor = p;
      const paso = Math.max(this.ajustes.borrador.tamano / 4 / this.camara.zoom, 0.5);
      const n = Math.max(1, Math.ceil(Math.hypot(mundo.x - g.ultimo.x, mundo.y - g.ultimo.y) / paso));
      for (let k = 1; k <= n; k++) this._borrarEn(g.ultimo.x + ((mundo.x - g.ultimo.x) * k) / n, g.ultimo.y + ((mundo.y - g.ultimo.y) * k) / n, g);
      g.ultimo = mundo;
      this.pedirDibujo();
    } else if (g.tipo === 'paneo') {
      this.camara = mover(this.camara, p.x - g.ultimo.x, p.y - g.ultimo.y);
      g.ultimo = p;
      this._camaraCambio();
    } else if (g.tipo === 'mover') {
      if (!g.movido && Math.hypot(p.x - g.inicioPantalla.x, p.y - g.inicioPantalla.y) < 3) return;
      g.movido = true;
      const { dx, dy } = this._snapMover(g.origenes, mundo.x - g.inicio.x, mundo.y - g.inicio.y);
      this.escena.transitorio([...g.origenes].map(([id, o]) => ({ id, antes: o, despues: trasladar(o, dx, dy) })));
    } else if (g.tipo === 'texto') {
      g.actual = mundo;
      this.pedirDibujo();
    } else if (g.tipo === 'redimensionar') {
      let dx = mundo.x - g.inicio.x, dy = mundo.y - g.inicio.y;
      if (!e.shiftKey) { const asa = manijas(g.original).find((h) => h.n === g.manija); if (asa) ({ dx, dy } = this._snapDelta(asa, dx, dy)); }
      const r = redimensionar(g.original, g.manija, dx, dy, e.shiftKey);
      const nuevo = esLinea(g.original) ? moverExtremo(g.original, g.manija, dx, dy)
        : g.original.tipo === 'texto' ? this._ajustarTexto({ ...g.original, ...r }, g.original) : { ...g.original, ...r };
      this.escena.transitorio([{ id: g.original.id, antes: g.original, despues: nuevo }]);
      g.cambio = true;
    } else if (g.tipo === 'marco') {
      g.actual = mundo;
      const r = normalizarRect(g.inicio.x, g.inicio.y, mundo.x, mundo.y);
      const sel = new Set(g.base);
      for (const el of this.escena.lista()) if (rectsSeCruzan(el, r)) sel.add(el.id);
      this.seleccion = sel;
      this._notificar(); this.pedirDibujo();
    } else if (g.tipo === 'crear') {
      let fin = mundo;
      if (e.shiftKey) {
        // Mayús: líneas en múltiplos de 45°; las demás figuras, con lados iguales
        const dx = mundo.x - g.inicio.x, dy = mundo.y - g.inicio.y;
        if (esLinea(g.elemento)) {
          const paso = Math.PI / 4, ang = Math.round(Math.atan2(dy, dx) / paso) * paso, len = Math.hypot(dx, dy);
          fin = { x: g.inicio.x + len * Math.cos(ang), y: g.inicio.y + len * Math.sin(ang) };
        } else { const l = Math.max(Math.abs(dx), Math.abs(dy)); fin = { x: g.inicio.x + Math.sign(dx || 1) * l, y: g.inicio.y + Math.sign(dy || 1) * l }; }
      }
      if (!e.shiftKey) fin = this._snapPunto(fin);
      const nuevo = esLinea(g.elemento) ? lineaDesdeExtremos(g.elemento, g.inicio, fin) : { ...g.elemento, ...normalizarRect(g.inicio.x, g.inicio.y, fin.x, fin.y) };
      this.escena.transitorio([{ id: nuevo.id, antes: g.actual, despues: nuevo }]);
      g.actual = nuevo;
    }
  }

  _hover(p) {
    if (this.herramienta !== 'seleccionar' || this.espacio) { this._cursor(); return; }
    const m = this._mundo(p), z = this.camara.zoom;
    const unico = this._unicoRedimensionable();
    const h = unico && manijaEn(unico, m.x, m.y, 9 / z);
    if (h) { this._cursor(CURSOR_MANIJA[h]); return; }
    this._cursor(this._elementoEn(m, 3 / z) ? 'move' : null);
  }

  _arriba(e) {
    if (this.ignorados.delete(e.pointerId)) return;
    this.punteros.delete(e.pointerId);
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
    if (this.pellizco) { if (this.punteros.size < 2) { this.pellizco = null; this._cursor(); } return; }
    const g = this.gesto;
    if (g && g.pointerId !== undefined && g.pointerId !== e.pointerId) return;
    this.gesto = null;
    if (!g) return;
    if (e.pointerType === 'touch') this.cursor = null;
    if (g.tipo === 'dibujar') {
      this._cache = null;
      const pts = simplificar(g.puntos, 0.25 / this.camara.zoom);
      const ultimo = pts[pts.length - 1];
      if (ultimo) this.cursorTexto = { x: ultimo[0], y: ultimo[1] };
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, {
        ...cajaDeTrazo(pts, g.grosor), z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(pts[0] ? pts[0][1] : this.camara.y),
        datos: { puntos: pts, color: g.color, grosor: g.grosor, opacidad: g.opacidad, herramienta: g.herramienta, variable: g.variable },
      });
      this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'dibujar');
    } else if (g.tipo === 'borrar') {
      this.escena.registrar(g.cambios, 'borrar');
    } else if (g.tipo === 'texto') {
      this._soltarTexto(g, e);
    } else if (g.tipo === 'marco' && g.dobleVacio && Math.hypot(this._pos(e).x - g.inicioPantalla.x, this._pos(e).y - g.inicioPantalla.y) < 6) {
      // el texto nuevo nace con su primer renglón donde se hizo doble clic (y guiado por los renglones, si están activos)
      this._crearTextoDirecto(g.inicio.x, g.inicio.y - Math.round(this.ajustes.texto.tamano) * 0.7);
    } else if (g.tipo === 'mover' && !g.movido && g.sobreTexto) {
      this._toqueSobreTexto(g.sobreTexto, e);
    } else if (g.tipo === 'mover' && g.movido) {
      this.escena.registrar([...g.origenes].map(([id, o]) => ({ id, antes: o, despues: this.escena.get(id) })), 'mover');
    } else if (g.tipo === 'redimensionar' && g.cambio) {
      this.escena.registrar([{ id: g.original.id, antes: g.original, despues: this.escena.get(g.original.id) }], 'redimensionar');
    } else if (g.tipo === 'crear' && g.actual) {
      const el = g.actual;
      if (el.ancho * this.camara.zoom < 4 && el.alto * this.camara.zoom < 4) {
        this.escena.transitorio([{ id: el.id, antes: el, despues: null }]);
      } else {
        this.escena.registrar([{ id: el.id, antes: null, despues: el }], 'crear');
        this.seleccion = new Set([el.id]);
        this.herramienta = 'seleccionar';
      }
    }
    this._cursor(); this._notificar(); this.pedirDibujo();
  }

  _cancelado(e) {
    if (this.ignorados.delete(e.pointerId)) return; // un toque de palma cancelado no debe cortar el trazo del lápiz
    this.punteros.delete(e.pointerId);
    if (this.punteros.size < 2) this.pellizco = null;
    this._cancelarGesto();
    this._cursor(); this._notificar(); this.pedirDibujo();
  }

  // Deshace sin dejar rastro lo que un gesto interrumpido había aplicado a modo de vista previa.
  _cancelarGesto() {
    const g = this.gesto;
    this.gesto = null;
    if (!g) return;
    this._cache = null;
    if (g.tipo === 'borrar' && g.cambios.length) this.escena.transitorio(invertir(g.cambios));
    else if (g.tipo === 'mover' && g.movido) this.escena.transitorio([...g.origenes].map(([id, o]) => ({ id, antes: this.escena.get(id), despues: o })));
    else if (g.tipo === 'redimensionar' && g.cambio) this.escena.transitorio([{ id: g.original.id, antes: this.escena.get(g.original.id), despues: g.original }]);
    else if (g.tipo === 'crear' && g.actual) this.escena.transitorio([{ id: g.actual.id, antes: g.actual, despues: null }]);
    this.pedirDibujo();
  }

  // Guarda de inmediato cualquier trazo o modificación en curso si se va a cerrar o cambiar de pestaña.
  finalizarGestoEnCurso() {
    const g = this.gesto;
    if (!g) return;
    this.gesto = null;
    if (g.tipo === 'dibujar' && g.puntos?.length) {
      this._cache = null;
      const pts = simplificar(g.puntos, 0.25 / this.camara.zoom);
      const ultimo = pts[pts.length - 1];
      if (ultimo) this.cursorTexto = { x: ultimo[0], y: ultimo[1] };
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, {
        ...cajaDeTrazo(pts, g.grosor), z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(pts[0] ? pts[0][1] : this.camara.y),
        datos: { puntos: pts, color: g.color, grosor: g.grosor, opacidad: g.opacidad, herramienta: g.herramienta, variable: g.variable },
      });
      this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'dibujar');
    } else if (g.tipo === 'borrar') {
      if (g.cambios?.length) this.escena.registrar(g.cambios, 'borrar');
    } else if (g.tipo === 'mover' && g.movido) {
      this.escena.registrar([...g.origenes].map(([id, o]) => ({ id, antes: o, despues: this.escena.get(id) })), 'mover');
    } else if (g.tipo === 'redimensionar' && g.cambio) {
      this.escena.registrar([{ id: g.original.id, antes: g.original, despues: this.escena.get(g.original.id) }], 'redimensionar');
    } else if (g.tipo === 'crear' && g.actual) {
      const el = g.actual;
      if (el.ancho * this.camara.zoom >= 4 || el.alto * this.camara.zoom >= 4) {
        this.escena.registrar([{ id: el.id, antes: null, despues: el }], 'crear');
      }
    }
    this.pedirDibujo();
  }

  _rueda(e) {
    e.preventDefault();
    if (this.gesto && (this.gesto.tipo === 'dibujar' || this.gesto.tipo === 'borrar')) return;
    const p = this._pos(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    this.camara = zoomEn(this.camara, p.x, p.y, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)));
    this._camaraCambio();
  }

  // ---------- teclado ----------
  _tecla(e) {
    const t = e.target;
    if (this._enCampo(t)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();
    if (!ctrl && !e.altKey && !e.isComposing && e.key?.length === 1 && e.key !== ' ' && this.puedeHerramienta('texto') && t?.tagName !== 'BUTTON') {
      if (this._escribirDirectoDesdeTeclado(e.key)) { e.preventDefault(); return; }
    }
    if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) this.rehacer(); else this.deshacer(); }
    else if (ctrl && k === 'y') { e.preventDefault(); this.rehacer(); }
    else if (ctrl && k === 'a') { e.preventDefault(); this.seleccionarTodo(); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.eliminarSeleccion(); }
    else if (k === 'escape') { this._cancelarGesto(); this.seleccion = new Set(); this._notificar(); this.pedirDibujo(); }
    else if (e.code === 'Space' && t?.tagName !== 'BUTTON') {
      if (!ctrl && !e.altKey && this.puedeHerramienta('texto') && (this.herramienta === 'texto' || this._unicoTexto() || this.escritura === 'teclado')) {
        if (this._escribirDirectoDesdeTeclado(' ')) { e.preventDefault(); return; }
      }
      e.preventDefault();
      if (!this.espacio) { this.espacio = true; this._cursor(); }
    }
    else if (k === 'enter' && !ctrl && this._unicoTexto()) { e.preventDefault(); this.editarTexto(this._unicoTexto().id); }
    else if (k === 'g' && !ctrl && !e.altKey && !this.puedeHerramienta('texto')) this.alternarRenglones();
    else if (k === 'g' && !ctrl && e.altKey) this.alternarRenglones();
    else if (!ctrl && !e.altKey) {
      const h = { v: 'seleccionar', h: 'mano', p: 'lapiz', m: 'resaltador', b: 'borrador', t: 'texto', r: 'rectangulo', e: 'elipse', l: 'linea', a: 'flecha' }[k];
      if (h) { this.setHerramienta(h); return; }
    } else if (!ctrl && e.altKey) {
      const h = { v: 'seleccionar', h: 'mano', p: 'lapiz', m: 'resaltador', b: 'borrador', t: 'texto', r: 'rectangulo', e: 'elipse', l: 'linea', a: 'flecha', g: 'renglones' }[k];
      if (h === 'renglones') this.alternarRenglones();
      else if (h) this.setHerramienta(h);
    }
  }

  _teclaArriba(e) { if (e.code === 'Space') { this.espacio = false; this._cursor(); } }

  // ---------- acciones para la interfaz ----------
  puedeHerramienta(h) {
    if (this.escritura === 'mano') return h !== 'texto';
    if (this.escritura === 'teclado') return !HERRAMIENTAS_DE_MANO.includes(h);
    return true;
  }

  setHerramienta(h) {
    if (this.escritura === 'mano' && h === 'texto') return;
    if (this.escritura === 'teclado' && HERRAMIENTAS_DE_MANO.includes(h)) return;
    if (!this.puedeHerramienta(h)) return;
    this.cerrarTexto(); this._cancelarGesto(); this.herramienta = h; this._cursor(); this._notificar(); this.pedirDibujo();
  }
  configurar(herramienta, parche) {
    this.ajustes[herramienta] = { ...this.ajustes[herramienta], ...parche };
    this.alAjustes(this.ajustes);
    this._notificar(); this.pedirDibujo();
  }

  setDedoDibuja(v) { this.dedoDibuja = v; this._dedoManual = true; this._notificar(); }

  // historialExtra (opcional): historial de nivel superior (por ejemplo, las operaciones sobre la lista de tarjetas).
  // Se usa solo cuando el historial de la escena actual no tiene nada que deshacer o rehacer.
  deshacer() {
    if (this.editor) { this.editor.deshacer(); return; }
    this._cancelarGesto();
    if (!this.escena.historial.puedeDeshacer() && this.historialExtra?.puedeDeshacer()) { this.historialExtra.deshacer(); return; }
    this.escena.deshacer();
  }
  rehacer() {
    if (this.editor) { this.editor.rehacer(); return; }
    this._cancelarGesto();
    if (!this.escena.historial.puedeRehacer() && this.historialExtra?.puedeRehacer()) { this.historialExtra.rehacer(); return; }
    this.escena.rehacer();
  }
  seleccionarTodo() { this.seleccion = new Set(this.escena.lista().map((e) => e.id)); this._notificar(); this.pedirDibujo(); }

  eliminarSeleccion() {
    const cambios = [...this.seleccion].map((id) => ({ id, antes: this.escena.get(id), despues: null })).filter((c) => c.antes);
    this.seleccion = new Set();
    this.escena.ejecutar(cambios, 'eliminar');
  }

  reordenar(modo) { if (this.seleccion.size) this.escena.reordenar([...this.seleccion], modo); }

  async insertarImagen(archivo, mundo = null) {
    try {
      const procesada = await procesarImagen(archivo);
      const blob = await guardarBlob(procesada.blob, { tipo: procesada.tipo, nombre: procesada.nombre });
      const p = mundo || this._cursorTextoPosicion();
      const pagina = this._obtenerContenedor(p.y);
      const marco = Array.isArray(this.marco)
        ? this.marco.find((m) => m.numero === pagina) || this.marco[0]
        : this.marco;
      const maxAncho = marco ? Math.max(80, marco.ancho - 120) : Math.max(80, this.ancho * 0.7 / this.camara.zoom);
      const escala = Math.min(1, maxAncho / procesada.anchoOriginal, 480 / procesada.altoOriginal);
      const ancho = Math.max(2, procesada.anchoOriginal * escala);
      const alto = Math.max(2, procesada.altoOriginal * escala);
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.IMAGEN, {
        x: p.x, y: p.y, ancho, alto, z: this.escena.zMax() + 1, contenedor: pagina,
        datos: { blobId: blob.id, anchoOriginal: procesada.anchoOriginal, altoOriginal: procesada.altoOriginal, nombre: procesada.nombre },
      });
      this.seleccion = new Set([el.id]);
      this.escena.ejecutar([{ id: el.id, antes: null, despues: el }], 'insertar imagen');
      this.alImagenError('');
      this.pedirDibujo();
      return el;
    } catch (error) {
      this.alImagenError(error instanceof Error ? error.message : 'No se pudo insertar la imagen.');
      return null;
    }
  }

  _archivoImagen(transferencia) {
    if (!transferencia) return null;
    const desdeItems = [...(transferencia.items || [])]
      .filter((item) => item.kind === 'file' && /^image\/(jpeg|png|webp)$/i.test(item.type))
      .map((item) => item.getAsFile()).find(Boolean);
    if (desdeItems) return desdeItems;
    return [...(transferencia.files || [])].find((f) => /^image\/(jpeg|png|webp)$/i.test(f.type)) || null;
  }

  _arrastrarArchivo(e) { if (this._archivoImagen(e.dataTransfer)) e.preventDefault(); }

  _soltarArchivo(e) {
    const archivo = this._archivoImagen(e.dataTransfer);
    if (!archivo) return;
    e.preventDefault(); e.stopPropagation();
    const mundo = this._mundo(this._pos(e));
    this.cursorTexto = mundo;
    this.insertarImagen(archivo, mundo);
  }

  zoomPaso(factor) { this.camara = zoomEn(this.camara, this.ancho / 2, this.alto / 2, factor); this._camaraCambio(); }
  zoomReal() { this.camara = zoomEn(this.camara, this.ancho / 2, this.alto / 2, 1 / this.camara.zoom); this._camaraCambio(); }

  // ---------- renglones (Etapa 8) ----------
  _ahora() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  _fondoRenglones() { return { cfg: this.renglones, opacidad: opacidadRenglones(this.renglones, this._ahora(), this._destello) }; }

  // Muestra los renglones un momento con fundido (en modo «breve» u «ocultos»).
  _destellar(segundos) {
    if (this.renglones.modo === 'siempre') return;
    this._destello = { inicio: this._ahora(), duracion: segundos };
    this.pedirDibujo();
  }

  mostrarRenglones() { this._destellar(this.renglones.modo === 'breve' ? this.renglones.duracion : 1.5); }

  // parche: cualquier campo de la configuración. previa: al cambiar el estilo, la separación, etc. se muestra un instante para ver el efecto.
  configurarRenglones(parche, { previa = false } = {}) {
    const antes = this.renglones;
    this.renglones = normalizarRenglones({ ...antes, ...parche });
    if (this.renglones.activos && !antes.activos && this.renglones.modo === 'breve') this._destellar(this.renglones.duracion);
    else if (previa && this.renglones.activos) this._destellar(this.renglones.modo === 'breve' ? this.renglones.duracion : 1.5);
    this.refrescarTextos();
    this.alRenglones(this.renglones);
    this._notificar(); this.pedirDibujo();
  }

  alternarRenglones() { this.configurarRenglones({ activos: !this.renglones.activos }); }

  // Alinear al renglón: solo si el usuario lo activó. Un punto del mundo → el punto de la guía más cercano.
  _snapPunto(p) { return alinearPunto(this.renglones, p); }

  // Ajusta un desplazamiento (dx, dy) para que el punto de referencia caiga sobre la guía.
  _snapDelta(ref, dx, dy, forzar = false) {
    const cfg = forzar ? { ...this.renglones, alinear: true } : this.renglones;
    if (!guiaActiva(cfg)) return { dx, dy };
    const q = alinearPunto(cfg, { x: ref.x + dx, y: ref.y + dy });
    return { dx: q.x - ref.x, dy: q.y - ref.y };
  }

  // Punto del elemento que se apoya en la guía: la base del primer renglón en un texto; la esquina en lo demás.
  _referenciaGuia(el) {
    return el.tipo === 'texto' ? { x: el.x, y: el.y + baseDelPrimerRenglon(el.datos, el.ancho, this._opcionesLayout(el.datos)) } : { x: el.x, y: el.y };
  }

  _snapMover(origenes, dx, dy) {
    const textoGuiado = [...origenes.values()].some((el) => el.tipo === 'texto' && el.datos.composicion === 'guiada');
    if (!guiaActiva(this.renglones) && !(textoGuiado && this.renglones.activos && this.renglones.estilo !== 'liso')) return { dx, dy };
    const ref = [...origenes.values()].filter((o) => o.tipo !== 'trazo').sort((a, b) => a.y - b.y || a.x - b.x)[0];
    return ref ? this._snapDelta(this._referenciaGuia(ref), dx, dy, textoGuiado) : { dx, dy };
  }

  // Centra la vista en un punto del mundo sin cambiar el zoom (lo usa el minimapa).
  irA(x, y) {
    this.camara = { ...this.camara, x: x - this.ancho / 2 / this.camara.zoom, y: y - this.alto / 2 / this.camara.zoom };
    this._camaraCambio();
  }

  // Conecta (o desconecta con null) el canvas del minimapa.
  conectarMinimapa(canvas) {
    this.minimapa?.destruir();
    this.minimapa = canvas ? new Minimapa(canvas, this) : null;
    this.pedirDibujo();
  }

  // Cambia el estilo de las figuras seleccionadas y de las que se creen de ahí en adelante.
  // parche: { borde?, relleno? (null = sin relleno), grosor? (en unidades del mundo) }
  estiloFiguras(parche) {
    const cambios = [];
    for (const id of this.seleccion) {
      const el = this.escena.get(id);
      if (!el || el.tipo !== 'figura') continue;
      const d = { ...el.datos };
      if ('borde' in parche) d.borde = parche.borde;
      if ('relleno' in parche && !esLinea(el)) d.relleno = parche.relleno;
      if ('grosor' in parche) d.grosor = Math.max(0.5, parche.grosor);
      cambios.push({ id, antes: el, despues: { ...el, datos: d } });
    }
    if (cambios.length) this.escena.ejecutar(cambios, 'estilo');
    this.configurar('figura', parche);
  }

  encuadrarTodo() {
    const r = this.escena.limites();
    this.camara = r ? encuadrar(r, this.ancho, this.alto) : camaraInicial();
    this._camaraCambio();
  }

  // ---------- texto con teclado (Etapa 6) ----------
  _enCampo(t) {
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || !!t.isContentEditable || !!(t.closest && t.closest('[data-nt-editor]')));
  }

  _unicoTexto() {
    const el = this.seleccion.size === 1 ? this.escena.get([...this.seleccion][0]) : null;
    return el && el.tipo === 'texto' ? el : null;
  }

  // Al ensanchar un texto, el alto lo decide el contenido; si el borde izquierdo se movió, se respeta el borde derecho.
  _ajustarTexto(nuevo, original) {
    const ancho = Math.max(40, nuevo.ancho);
    const x = nuevo.x !== original.x ? original.x + original.ancho - ancho : nuevo.x;
    return { ...nuevo, x, ancho, alto: layoutDe(nuevo.datos, ancho, undefined, this._opcionesLayout(nuevo.datos)).alto };
  }

  _opcionesLayout(datos) { return datos?.composicion === 'guiada' ? { interlineado: this.renglones.interlineado } : {}; }

  // Herramienta Texto: un clic crea (o edita el texto que haya ahí); arrastrar define el ancho.
  _soltarTexto(g, e) {
    const p = this._pos(e);
    if (Math.hypot(p.x - g.inicioPantalla.x, p.y - g.inicioPantalla.y) < 6) {
      const el = this._elementoEn(g.inicio, 4 / this.camara.zoom);
      if (el && el.tipo === 'texto') this.editarTexto(el.id, { x: e.clientX, y: e.clientY });
      else this.crearTexto(g.inicio.x, g.inicio.y, 0, true);
    } else {
      const r = normalizarRect(g.inicio.x, g.inicio.y, g.actual.x, g.actual.y);
      this.crearTexto(r.x, r.y, Math.max(40, r.ancho));
    }
  }

  // Doble clic (o doble toque) sobre un texto con la herramienta Seleccionar.
  _toqueSobreTexto(id, e) {
    const p = this._pos(e), ahora = Date.now(), u = this._ultimoToque;
    if (u && u.id === id && ahora - u.t < 450 && Math.hypot(p.x - u.x, p.y - u.y) < 14) { this._ultimoToque = null; this.editarTexto(id, { x: e.clientX, y: e.clientY }); }
    else this._ultimoToque = { id, t: ahora, x: p.x, y: p.y };
  }

  crearTexto(x, y, ancho = 0, enClic = false) {
    if (!this.puedeHerramienta('texto')) return;
    const z = this.camara.zoom;
    const tam = Math.max(6, Math.min(800, Math.round(this.ajustes.texto.tamano)));
    const datos = datosTextoNuevo(tam);
    const ancho1 = ancho || Math.min(3000, Math.max(80, Math.round(320 / z)));
    let ex = x, ey = enClic ? y - tam * 0.7 : y;
    if (guiaActiva(this.renglones)) { // con «alinear al renglón», el primer renglón del texto se apoya en la guía
      const base = baseDelPrimerRenglon(datos, ancho1, this._opcionesLayout(datos));
      const q = alinearPunto(this.renglones, { x: ex, y: ey + base });
      ey = q.y - base;
      if (this.renglones.estilo !== 'rayado') ex = q.x;
    }
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TEXTO, {
      x: ex, y: ey, ancho: ancho1, alto: layoutDe(datos, ancho1).alto, z: this.escena.zMax() + 1, contenedor: this._obtenerContenedor(ey), datos,
    });
    this._abrirEditor(el, true);
  }

  editarTexto(id, punto) {
    const el = this.escena.get(id);
    if (!el || el.tipo !== 'texto' || !this.puedeHerramienta('texto')) return;
    this._abrirEditor(el, false, punto);
  }

  _abrirEditor(el, nuevo, punto, directo = false) {
    this.cerrarTexto();
    this._cancelarGesto();
    this.seleccion = new Set();
    const base = el.ancho > 20 ? el : { ...el, ancho: 300 }; // los textos de prueba antiguos no tenían ancho
    this.texto = { id: el.id, base, original: nuevo ? null : el, nuevo, directo };
    this.ocultoId = el.id;
    this.editor = new EditorTexto(this.capaTexto, {
      el: base, camara: this.camara, guia: this.renglones,
      alImagen: (archivo, punto) => this._insertarImagenDesdeEditor(archivo, punto),
      alCambiar: () => this._notificar(),
      alTerminar: (motivo) => this._terminarTexto(motivo),
      alPuntoDeControl: () => this.puntoDeControlTexto(),
      alTamano: (n) => this.configurar('texto', { tamano: Math.max(1, Math.round(n)) }),
    });
    this.editor.enfocar(punto);
    this._vigilarVisualViewport();
    this._notificar(); this.pedirDibujo();
    this._despejarBarra();
  }

  _insertarImagenDesdeEditor(archivo, punto) {
    const rect = this.canvas.getBoundingClientRect();
    const posicion = punto && Number.isFinite(punto.x) && Number.isFinite(punto.y)
      ? this._mundo({ x: punto.x - rect.left, y: punto.y - rect.top })
      : this._cursorTextoPosicion();
    this.cerrarTexto();
    this.insertarImagen(archivo, posicion);
  }

  // La barra de formato aparece arriba: si tapa el texto, se baja la vista lo justo para dejarlo a la vista.
  _despejarBarra() {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const barra = this.editor && document.querySelector('[data-nt-barra]');
      if (!barra) return;
      const limite = barra.getBoundingClientRect().bottom + 14;
      const arriba = this.editor.rect().top;
      if (arriba < limite) { this.camara = mover(this.camara, 0, limite - arriba); this._camaraCambio(); }
    });
  }

  _datosDeEditor(ed, base = this.texto?.base) {
    return { ...(base?.datos?.composicion ? { composicion: base.datos.composicion } : {}), bloques: ed.leer(), tamano: ed.tamano, color: ed.colorBase };
  }
  _elementoDe(base, datos) { return { ...base, datos, alto: layoutDe(datos, base.ancho, undefined, this._opcionesLayout(datos)).alto }; }

  // Pasa lo escrito a la escena sin cerrar el editor ni tocar el historial: así el autoguardado
  // también guarda el texto mientras se escribe y no se pierde si se cierra la pestaña.
  puntoDeControlTexto() {
    if (!this.editor || !this.texto) return;
    const t = this.texto, actual = this.escena.get(t.id);
    const datos = this._datosDeEditor(this.editor, t.base);
    if (esVacio(datos.bloques)) {
      if (t.nuevo && actual) this.escena.transitorio([{ id: t.id, antes: actual, despues: null }]);
      return;
    }
    this.escena.transitorio([{ id: t.id, antes: actual || null, despues: this._elementoDe(t.base, datos) }]);
  }

  // Termina la edición y deja una sola acción en el historial. Devuelve true si había un texto abierto.
  cerrarTexto() {
    const ed = this.editor;
    if (!ed) return false;
    const t = this.texto;
    const puntoInsercion = t.directo ? ed.puntoInsercion() : null;
    const datos = this._datosDeEditor(ed, t.base);
    this.editor = null; this.texto = null;
    ed.destruir();
    this._quitarVisualViewport();
    this.ocultoId = null;
    const actual = this.escena.get(t.id);
    if (esVacio(datos.bloques)) {
      if (t.nuevo) { if (actual) this.escena.transitorio([{ id: t.id, antes: actual, despues: null }]); }
      else this.escena.ejecutar([{ id: t.id, antes: t.original, despues: null }], 'eliminar texto');
    } else {
      const nuevo = this._elementoDe(t.base, datos);
      if (t.nuevo) this.escena.ejecutar([{ id: t.id, antes: null, despues: nuevo }], 'texto');
      else if (JSON.stringify(t.original.datos) !== JSON.stringify(datos) || t.original.ancho !== nuevo.ancho) this.escena.ejecutar([{ id: t.id, antes: t.original, despues: nuevo }], 'editar texto');
      else if (actual !== t.original) this.escena.transitorio([{ id: t.id, antes: actual, despues: t.original }]);
    }
    if (t.directo && puntoInsercion) {
      const rect = this.canvas.getBoundingClientRect();
      this.cursorTexto = pantallaAMundo(this.camara, puntoInsercion.x - rect.left, puntoInsercion.y - rect.top);
    } else if (actual || t.base) {
      const elRef = actual || t.base;
      this.cursorTexto = { x: elRef.x, y: elRef.y + (elRef.alto || 24) };
    }
    this._notificar(); this.pedirDibujo();
    return true;
  }

  // 'esc': el usuario terminó a propósito (queda seleccionado para moverlo); 'blur': el foco se fue a otro lado.
  _terminarTexto(motivo) {
    const t = this.texto;
    if (!t) return;
    const id = t.id;
    this.cerrarTexto();
    if (motivo === 'esc' && this.escena.get(id)) {
      this.herramienta = 'seleccionar';
      this.seleccion = new Set([id]);
      this._cursor(); this._notificar(); this.pedirDibujo();
      this.canvas.focus?.({ preventScroll: true });
    }
  }

  formatoTexto(accion, valor) {
    if (!this.editor) return;
    if (accion === 'terminar') { this._terminarTexto('esc'); return; }
    this.editor.aplicar(accion, valor);
  }

  insertarSimbolo(caracter) {
    if (typeof caracter !== 'string' || !caracter) return false;
    if (!this.editor) {
      if (!this.puedeHerramienta('texto')) return false;
      const p = this._cursorTextoPosicion();
      this._crearTextoDirecto(p.x, p.y);
    }
    return !!this.editor?.insertarTextoDirecto(caracter);
  }

  iniciarRecorteImagen() {
    const el = this.seleccion.size === 1 ? this.escena.get([...this.seleccion][0]) : null;
    if (!el || el.tipo !== 'imagen') return false;
    this.cerrarTexto();
    this._recorteEnCurso = { original: el };
    return true;
  }

  recortarImagen(parche) {
    const id = this._recorteEnCurso?.original.id || (this.seleccion.size === 1 ? [...this.seleccion][0] : null);
    const actual = id ? this.escena.get(id) : null;
    if (!actual || actual.tipo !== 'imagen') return;
    const datos = { ...actual.datos, recorte: recorteImagenSeguro({ ...actual.datos.recorte, ...parche }) };
    const nuevo = { ...actual, datos };
    if (this._recorteEnCurso?.original.id === id) this.escena.transitorio([{ id, antes: actual, despues: nuevo }]);
    else this.escena.ejecutar([{ id, antes: actual, despues: nuevo }], 'recortar imagen');
    this.pedirDibujo();
  }

  terminarRecorteImagen() {
    const sesion = this._recorteEnCurso;
    this._recorteEnCurso = null;
    if (!sesion) return;
    const actual = this.escena.get(sesion.original.id);
    if (actual && JSON.stringify(actual.datos.recorte) !== JSON.stringify(sesion.original.datos.recorte)) {
      this.escena.registrar([{ id: actual.id, antes: sesion.original, despues: actual }], 'recortar imagen');
    }
  }

  // Cuando termina de cargar una tipografía cambian las medidas: se recalcula el alto de cada texto.
  refrescarTextos() {
    const cambios = [];
    for (const el of this.escena.mapa.values()) {
      if (el.tipo !== 'texto' || !Array.isArray(el.datos.bloques) || (this.texto && this.texto.id === el.id)) continue;
      const opciones = this._opcionesLayout(el.datos);
      const base = baseDelPrimerRenglon(el.datos, el.ancho, opciones);
      let x = el.x, y = el.y;
      if (el.datos.composicion === 'guiada' && this.renglones.activos && this.renglones.estilo !== 'liso') {
        const q = alinearPunto({ ...this.renglones, alinear: true }, { x, y: y + base });
        x = q.x; y = q.y - base;
      }
      const alto = layoutDe(el.datos, el.ancho, undefined, opciones).alto;
      if (Math.abs(alto - el.alto) > 0.75 || Math.abs(x - el.x) > 0.75 || Math.abs(y - el.y) > 0.75) cambios.push({ id: el.id, antes: el, despues: { ...el, x, y, alto } });
    }
    if (cambios.length) this.escena.transitorio(cambios);
  }

  // Pegar fuera de un campo (por ejemplo desde Word o la web) crea un texto en la parte visible.
  _pegar(e) {
    if (!e.clipboardData) return;
    const archivo = this._archivoImagen(e.clipboardData);
    if (archivo && this.editor && !e.defaultPrevented) {
      e.preventDefault();
      this._insertarImagenDesdeEditor(archivo, this.editor.puntoInsercion());
      return;
    }
    if (archivo && !this._enCampo(e.target)) {
      e.preventDefault();
      this.insertarImagen(archivo);
      return;
    }
    if (this.editor || this._enCampo(e.target) || !this.puedeHerramienta('texto')) return;
    const html = e.clipboardData.getData('text/html');
    let bloques = html ? htmlAModelo(html, { colorBase: COLOR_TEXTO }) : [];
    if (esVacio(bloques)) bloques = textoAModelo(e.clipboardData.getData('text/plain'));
    if (esVacio(bloques)) return;
    e.preventDefault();
    const z = this.camara.zoom;
    const tam = Math.max(6, Math.round(this.ajustes.texto.tamano));
    const ancho = Math.max(80, Math.round(Math.min(520, this.ancho * 0.6) / z));
    const pos = pantallaAMundo(this.camara, this.ancho * 0.2, this.alto * 0.2);
    const datos = { bloques, tamano: tam, color: COLOR_TEXTO };
    const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TEXTO, { x: pos.x, y: pos.y, ancho, z: this.escena.zMax() + 1, datos });
    const nuevo = { ...el, alto: layoutDe(datos, ancho).alto };
    this.escena.ejecutar([{ id: nuevo.id, antes: null, despues: nuevo }], 'pegar');
    this.seleccion = new Set([nuevo.id]);
    this._notificar(); this.pedirDibujo();
  }

  // Copiar los textos seleccionados deja texto con formato (HTML) y texto plano en el portapapeles.
  _copiar(e) {
    if (this.editor || this._enCampo(e.target) || !e.clipboardData) return;
    const els = [...this.seleccion].map((id) => this.escena.get(id)).filter((x) => x && x.tipo === 'texto').sort((a, b) => a.y - b.y || a.x - b.x);
    if (!els.length) return;
    const bloques = els.flatMap((x) => bloquesDe(x.datos));
    e.clipboardData.setData('text/html', modeloAHtml(bloques));
    e.clipboardData.setData('text/plain', modeloATexto(bloques));
    e.preventDefault();
  }

  // En tablets, al abrirse el teclado se achica el área visible: se corre la vista para que lo escrito no quede tapado.
  _vigilarVisualViewport() {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (!vv || this._vv) return;
    this._vv = () => this._asegurarVisible();
    vv.addEventListener('resize', this._vv); vv.addEventListener('scroll', this._vv);
  }

  _quitarVisualViewport() {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (vv && this._vv) { vv.removeEventListener('resize', this._vv); vv.removeEventListener('scroll', this._vv); }
    this._vv = null;
  }

  _asegurarVisible() {
    const vv = window.visualViewport;
    if (!vv || !this.editor) return;
    const r = this.editor.rect();
    const limite = vv.offsetTop + vv.height - 16;
    if (r.bottom <= limite) return;
    const tope = this.canvas.getBoundingClientRect().top + 56;
    const dy = Math.min(r.bottom - limite, Math.max(0, r.top - tope));
    if (dy > 0) { this.camara = mover(this.camara, 0, -dy); this._camaraCambio(); }
  }

  // Herramientas de prueba de la etapa 4.
  generarFiguras(n) {
    const lado = Math.sqrt(n) * 100;
    const c = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    let z = this.escena.zMax();
    const cambios = [];
    for (let i = 0; i < n; i++) {
      const k = i % PALETA.length;
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.FIGURA, {
        x: c.x - lado / 2 + Math.random() * lado, y: c.y - lado / 2 + Math.random() * lado,
        ancho: 30 + Math.random() * 60, alto: 30 + Math.random() * 60, z: ++z,
        datos: { forma: i % 2 ? 'elipse' : 'rectangulo', relleno: PALETA[k], borde: BORDES[k], grosor: 2 },
      });
      cambios.push({ id: el.id, antes: null, despues: el });
    }
    this.escena.ejecutar(cambios, 'generar');
    this.encuadrarTodo();
  }

  generarTrazos(n) {
    const lado = Math.sqrt(n) * 140;
    const c = pantallaAMundo(this.camara, this.ancho / 2, this.alto / 2);
    let z = this.escena.zMax();
    const cambios = [];
    for (let i = 0; i < n; i++) {
      const x0 = c.x - lado / 2 + Math.random() * lado, y0 = c.y - lado / 2 + Math.random() * lado;
      const ang = Math.random() * Math.PI * 2, giro = (Math.random() - 0.5) * 0.25, np = 25 + Math.floor(Math.random() * 50);
      const pts = []; let a = ang, x = x0, y = y0;
      for (let k = 0; k < np; k++) { pts.push([x, y, 0.5]); a += giro + (Math.random() - 0.5) * 0.3; x += Math.cos(a) * 4; y += Math.sin(a) * 4; }
      const grosor = 2 + Math.random() * 2;
      const el = crearElemento(this.documentoId, TIPOS_ELEMENTO.TRAZO, { ...cajaDeTrazo(pts, grosor), z: ++z, datos: { puntos: pts, color: BORDES[i % BORDES.length], grosor, opacidad: 1, herramienta: 'lapiz', variable: i % 3 === 0 } });
      cambios.push({ id: el.id, antes: null, despues: el });
    }
    this.escena.ejecutar(cambios, 'generar');
    this.encuadrarTodo();
  }

  borrarTodo() { this.seleccionarTodo(); this.eliminarSeleccion(); }
}
