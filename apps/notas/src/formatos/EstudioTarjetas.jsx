// Modo estudio (bloque A): repaso de las tarjetas a pantalla completa, una por pantalla y solo de lectura.
// Navegación: flechas del teclado, toque o clic en los tercios laterales, deslizamiento y botones.
import { useCallback, useEffect, useRef, useState } from 'react';
import { dibujar } from '../lienzo/dibujo.js';
import { liberarImagenesCanvas } from '../herramientas/imagenes/recursos.js';
import {
  moverEstudio, pasoPorDeslizamiento, pasoPorTecla, pasoPorToque,
} from './estudio.js';

const MARGEN = 24; // espacio libre alrededor de la tarjeta (px)

export default function EstudioTarjetas({
  tarjetas, indiceInicial = 0, med, obtenerLista, renglones, onSalir,
}) {
  const raizRef = useRef(null);
  const escenarioRef = useRef(null);
  const canvasRef = useRef(null);
  const gestoRef = useRef(null);
  const [indice, setIndice] = useState(() => moverEstudio(indiceInicial, 0, tarjetas.length));
  const [tamano, setTamano] = useState({ ancho: 0, alto: 0 });
  const total = tarjetas.length;
  const tarjeta = tarjetas[indice];
  // La función de salida se guarda en una referencia: así el efecto de pantalla completa no se reinicia en cada renderizado
  const salirRef = useRef(onSalir);
  useEffect(() => { salirRef.current = onSalir; });
  const salir = useCallback(() => salirRef.current(), []);

  useEffect(() => () => liberarImagenesCanvas(canvasRef.current), []);

  const ir = useCallback((paso) => setIndice((i) => moverEstudio(i, paso, total)), [total]);

  // Pantalla completa cuando el navegador la permite; si no, queda la capa que cubre toda la ventana
  useEffect(() => {
    const raiz = raizRef.current;
    raiz?.focus();
    let activa = false;
    try {
      const p = raiz?.requestFullscreen?.();
      if (p && typeof p.then === 'function') p.then(() => { activa = true; }).catch(() => {});
    } catch {
      /* sin pantalla completa */
    }
    // Si el navegador sale de pantalla completa (por ejemplo, con Esc), se cierra el modo estudio
    const alCambiar = () => { if (activa && !document.fullscreenElement) salir(); };
    document.addEventListener('fullscreenchange', alCambiar);
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar);
      activa = false;
      try {
        if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
      } catch {
        /* ya no estaba en pantalla completa */
      }
    };
  }, [salir]);

  // Medida del escenario disponible
  useEffect(() => {
    const el = escenarioRef.current;
    if (!el) return undefined;
    const medir = () => setTamano({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dibujo de la tarjeta, ajustada al espacio disponible (solo lectura: no hay selección ni manijas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tarjeta || !tamano.ancho || !tamano.alto) return;
    const libreAncho = Math.max(50, tamano.ancho - 2 * MARGEN);
    const libreAlto = Math.max(50, tamano.alto - 2 * MARGEN);
    const zoom = Math.min(libreAncho / med.ancho, libreAlto / med.alto);
    const ancho = Math.round(med.ancho * zoom);
    const alto = Math.round(med.alto * zoom);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;
    const cx = canvas.getContext('2d');
    if (!cx) return;
    const lista = obtenerLista(tarjeta.id);
    const porId = new Map(lista.map((e) => [e.id, e]));
    const dibujarTarjeta = () => dibujar(cx, {
      camara: { x: 0, y: 0, zoom },
      ancho,
      alto,
      dpr,
      lista,
      escena: { get: (id) => porId.get(id) },
      seleccion: new Set(),
      marco: null,
      mostrarManijas: null,
      renglones: renglones ? { cfg: renglones, opacidad: 1 } : null,
      guiaTexto: renglones,
      marcoDocumento: null,
      alImagenLista: (cv) => { if (cv === canvas) dibujarTarjeta(); },
    });
    dibujarTarjeta();
  }, [tarjeta, tamano, med, obtenerLista, renglones]);

  function alTecla(e) {
    if (e.key === 'Escape') { e.preventDefault(); salir(); return; }
    const nuevo = pasoPorTecla(e.key, indice, total);
    if (nuevo === null) return;
    e.preventDefault();
    setIndice(nuevo);
  }

  // Un solo gesto a la vez: toque o clic corto = zona; movimiento largo y horizontal = deslizamiento
  function alBajar(e) {
    if (gestoRef.current) return;
    gestoRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function alSoltar(e) {
    const g = gestoRef.current;
    if (!g || g.id !== e.pointerId) return;
    gestoRef.current = null;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const desliz = pasoPorDeslizamiento(dx, dy);
    if (desliz) { ir(desliz); return; }
    if (Math.hypot(dx, dy) < 10) {
      const caja = e.currentTarget.getBoundingClientRect();
      const paso = pasoPorToque(e.clientX - caja.left, caja.width);
      if (paso) ir(paso);
    }
  }
  function alCancelar() { gestoRef.current = null; }

  if (!tarjeta) return null;

  return (
    <div
      ref={raizRef}
      className="nt-estudio"
      role="dialog"
      aria-modal="true"
      aria-label="Modo estudio"
      tabIndex={-1}
      onKeyDown={alTecla}
    >
      <header className="nt-estudio__cab">
        <span className="nt-estudio__titulo">{tarjeta.titulo || `Tarjeta ${indice + 1}`}</span>
        <span className="nt-estudio__indicador" aria-live="polite">{indice + 1} de {total}</span>
        <button type="button" className="nt-btn" onClick={salir} aria-label="Salir del modo estudio">Salir</button>
      </header>

      <div
        ref={escenarioRef}
        className="nt-estudio__escenario"
        onPointerDown={alBajar}
        onPointerUp={alSoltar}
        onPointerCancel={alCancelar}
      >
        <canvas ref={canvasRef} className="nt-estudio__tarjeta" aria-label={`Tarjeta ${indice + 1} de ${total}`} />
      </div>

      <button
        type="button"
        className="nt-estudio__flecha nt-estudio__flecha--izq"
        disabled={indice <= 0}
        onClick={() => ir(-1)}
        aria-label="Tarjeta anterior"
      >
        ←
      </button>
      <button
        type="button"
        className="nt-estudio__flecha nt-estudio__flecha--der"
        disabled={indice >= total - 1}
        onClick={() => ir(1)}
        aria-label="Tarjeta siguiente"
      >
        →
      </button>
    </div>
  );
}
