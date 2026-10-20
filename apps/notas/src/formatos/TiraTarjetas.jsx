// Tira lateral y vista cuadrícula de tarjetas (Etapa 9 / Tarea A7).
// Permite visualizar miniaturas, navegar entre fichas y reordenar por arrastre táctil/puntero o teclado.
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { dibujar } from '../lienzo/dibujo.js';
import { liberarImagenesCanvas } from '../herramientas/imagenes/recursos.js';
import { calcularDestinoArrastre } from './tarjetas.js';

// Icono de agarre (asa) para reordenar con puntero o toque.
export function IconoAgarre() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

// Componente Miniatura (se redibuja solo si cambia `rev`, la revisión de contenido de esa tarjeta): dibuja una tarjeta en un canvas con zoom = ancho / med.ancho, fondo blanco y renglones.
export function Miniatura({
  tarjeta,
  med,
  obtenerLista,
  rev,
  renglones,
  ancho = 140,
}) {
  const canvasRef = useRef(null);
  const tarjetaId = tarjeta?.id;

  useEffect(() => () => liberarImagenesCanvas(canvasRef.current), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tarjetaId || !med?.ancho || !med?.alto) return;
    const cx = canvas.getContext('2d');
    if (!cx) return;

    const zoom = ancho / med.ancho;
    const alto = Math.max(1, Math.round(ancho * (med.alto / med.ancho)));
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;

    const lista = obtenerLista ? obtenerLista(tarjetaId) : [];
    const escena = { get: (id) => lista.find((x) => x.id === id) };

    const dibujarMiniatura = () => dibujar(cx, {
      camara: { x: 0, y: 0, zoom }, ancho, alto, dpr, lista, escena, seleccion: new Set(), marco: null, mostrarManijas: null,
      renglones: renglones ? { cfg: renglones, opacidad: 1 } : null,
      guiaTexto: renglones, marcoDocumento: null,
      alImagenLista: (cv) => { if (cv === canvas) dibujarMiniatura(); },
    });
    dibujarMiniatura();
  }, [tarjetaId, rev, med, renglones, ancho, obtenerLista]);

  const altoCalculado = Math.max(1, Math.round(ancho * ((med?.alto || 100) / (med?.ancho || 150))));

  return (
    <canvas
      ref={canvasRef}
      className="nt-miniatura-canvas"
      width={ancho}
      height={altoCalculado}
      style={{ width: `${ancho}px`, height: `${altoCalculado}px` }}
    />
  );
}

// Hook para gestionar el arrastre accesible con eventos de puntero (setPointerCapture)
function useArrastreTarjetas(contenedorRef, onReordenar) {
  const arrastreRef = useRef(null);
  const [estadoArrastre, setEstadoArrastre] = useState(null); // { origen, destino }

  const iniciarArrastre = useCallback((e, idx) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* puntero no capturable */
    }
    arrastreRef.current = {
      punteroId: e.pointerId,
      elemento: e.currentTarget,
      origen: idx,
      destino: idx,
    };
    setEstadoArrastre({ origen: idx, destino: idx });
  }, []);

  const moverArrastre = useCallback((e) => {
    if (!arrastreRef.current || arrastreRef.current.punteroId !== e.pointerId) return;
    e.preventDefault();
    const nodos = contenedorRef.current?.querySelectorAll('[data-tarjeta-idx]');
    if (!nodos || !nodos.length) return;

    const rects = Array.from(nodos).map((nodo) => {
      const r = nodo.getBoundingClientRect();
      return {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right, alto: r.height, ancho: r.width,
      };
    });

    const nuevoDestino = calcularDestinoArrastre(rects, { x: e.clientX, y: e.clientY });
    if (nuevoDestino !== arrastreRef.current.destino) {
      arrastreRef.current.destino = nuevoDestino;
      setEstadoArrastre((prev) => (prev ? { ...prev, destino: nuevoDestino } : null));
    }
  }, [contenedorRef]);

  const finalizarArrastre = useCallback((e) => {
    if (!arrastreRef.current || arrastreRef.current.punteroId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* liberar */
    }
    const { origen, destino } = arrastreRef.current;
    arrastreRef.current = null;
    setEstadoArrastre(null);

    if (origen !== destino && origen !== undefined && destino !== undefined) {
      onReordenar(origen, destino);
    }
  }, [onReordenar]);

  const cancelarArrastre = useCallback((e) => {
    if (!arrastreRef.current || arrastreRef.current.punteroId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignorar */
    }
    arrastreRef.current = null;
    setEstadoArrastre(null);
  }, []);

  return {
    estadoArrastre,
    iniciarArrastre,
    moverArrastre,
    finalizarArrastre,
    cancelarArrastre,
  };
}

// Columna vertical a la izquierda del lienzo
export default function TiraTarjetas({
  tarjetas,
  tarjetaActivaId,
  med,
  obtenerLista,
  revs,
  renglones,
  onSeleccionar,
  onReordenar,
  onAgregar,
  onDuplicar,
}) {
  const listaRef = useRef(null);
  const {
    estadoArrastre,
    iniciarArrastre,
    moverArrastre,
    finalizarArrastre,
    cancelarArrastre,
  } = useArrastreTarjetas(listaRef, onReordenar);

  return (
    <aside className="nt-tira" aria-label="Tira de tarjetas">
      <div className="nt-tira__acciones">
        <button
          type="button"
          className="nt-btn"
          onClick={onAgregar}
          title="Agregar una tarjeta nueva"
          aria-label="Agregar tarjeta"
        >
          + Agregar
        </button>
        <button
          type="button"
          className="nt-btn"
          onClick={onDuplicar}
          title="Duplicar la tarjeta activa"
          aria-label="Duplicar tarjeta"
        >
          Duplicar
        </button>
      </div>

      <div className="nt-tira__lista" ref={listaRef} role="region" aria-label="Lista de fichas">
        {tarjetas.map((t, idx) => {
          const esActiva = t.id === tarjetaActivaId;
          const esArrastrada = estadoArrastre?.origen === idx;
          const esDestino = estadoArrastre && estadoArrastre.destino === idx && estadoArrastre.origen !== idx;
          const mostrarIndicadorAntes = esDestino && estadoArrastre.destino < estadoArrastre.origen;
          const mostrarIndicadorDespues = esDestino && estadoArrastre.destino > estadoArrastre.origen;

          return (
            <div key={t.id} style={{ display: 'grid', gap: '4px' }}>
              {mostrarIndicadorAntes && <div className="nt-linea-caida" aria-hidden="true" />}
              <div
                data-tarjeta-idx={idx}
                tabIndex={0}
                role="button"
                aria-label={`Tarjeta ${idx + 1}: ${t.titulo || 'Sin título'}${esActiva ? ', activa' : ''}`}
                aria-current={esActiva ? 'true' : undefined}
                className={`nt-item-tarjeta ${esActiva ? 'nt-item-tarjeta--activa' : ''} ${esArrastrada ? 'nt-item-tarjeta--arrastrando' : ''} ${esDestino ? 'nt-item-tarjeta--destino' : ''}`}
                onClick={() => onSeleccionar(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSeleccionar(t.id);
                  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
                    e.preventDefault();
                    if (idx > 0) onReordenar(idx, idx - 1);
                  } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
                    e.preventDefault();
                    if (idx < tarjetas.length - 1) onReordenar(idx, idx + 1);
                  }
                }}
              >
                <div className="nt-item-tarjeta__cab">
                  <span className="nt-item-tarjeta__num">#{idx + 1}</span>
                  <span
                    className="nt-asa-arrastre"
                    role="button"
                    tabIndex={-1}
                    title="Arrastrar para reordenar"
                    aria-label={`Mover tarjeta ${idx + 1}`}
                    onPointerDown={(e) => iniciarArrastre(e, idx)}
                    onPointerMove={moverArrastre}
                    onPointerUp={finalizarArrastre}
                    onPointerCancel={cancelarArrastre}
                  >
                    <IconoAgarre />
                  </span>
                </div>

                <Miniatura
                  tarjeta={t}
                  med={med}
                  obtenerLista={obtenerLista}
                  rev={revs?.[t.id] ?? 0}
                  renglones={renglones}
                  ancho={140}
                />

                <div className="nt-item-tarjeta__pie">
                  <span className="nt-item-tarjeta__titulo">{t.titulo || `Tarjeta ${idx + 1}`}</span>
                </div>
              </div>
              {mostrarIndicadorDespues && <div className="nt-linea-caida" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// Vista cuadrícula a pantalla completa
export function CuadriculaTarjetas({
  tarjetas,
  tarjetaActivaId,
  med,
  obtenerLista,
  revs,
  renglones,
  onSeleccionar,
  onReordenar,
  onCerrar,
}) {
  const rejillaRef = useRef(null);
  const {
    estadoArrastre,
    iniciarArrastre,
    moverArrastre,
    finalizarArrastre,
    cancelarArrastre,
  } = useArrastreTarjetas(rejillaRef, onReordenar);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  return (
    <div
      className="nt-fondo nt-fondo--cuadricula"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="nt-panel-cuadricula"
        role="dialog"
        aria-modal="true"
        aria-label="Cuadrícula de tarjetas"
      >
        <header className="nt-cuadricula__cab">
          <h2 className="nt-sub" style={{ margin: 0 }}>
            Cuadrícula de tarjetas ({tarjetas.length})
          </h2>
          <button
            type="button"
            className="nt-btn"
            onClick={onCerrar}
            aria-label="Cerrar cuadrícula de tarjetas"
          >
            Cerrar
          </button>
        </header>

        <div className="nt-cuadricula__rejilla" ref={rejillaRef} role="region" aria-label="Todas las tarjetas">
          {tarjetas.map((t, idx) => {
            const esActiva = t.id === tarjetaActivaId;
            const esArrastrada = estadoArrastre?.origen === idx;
            const esDestino = estadoArrastre && estadoArrastre.destino === idx && estadoArrastre.origen !== idx;

            return (
              <div
                key={t.id}
                data-tarjeta-idx={idx}
                tabIndex={0}
                role="button"
                aria-label={`Tarjeta ${idx + 1}: ${t.titulo || 'Sin título'}${esActiva ? ', activa' : ''}`}
                aria-current={esActiva ? 'true' : undefined}
                className={`nt-item-tarjeta ${esActiva ? 'nt-item-tarjeta--activa' : ''} ${esArrastrada ? 'nt-item-tarjeta--arrastrando' : ''} ${esDestino ? 'nt-item-tarjeta--destino' : ''}`}
                onClick={() => {
                  onSeleccionar(t.id);
                  onCerrar();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSeleccionar(t.id);
                    onCerrar();
                  } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
                    e.preventDefault();
                    if (idx > 0) onReordenar(idx, idx - 1);
                  } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
                    e.preventDefault();
                    if (idx < tarjetas.length - 1) onReordenar(idx, idx + 1);
                  }
                }}
              >
                <div className="nt-item-tarjeta__cab">
                  <span className="nt-item-tarjeta__num">#{idx + 1}</span>
                  <span
                    className="nt-asa-arrastre"
                    role="button"
                    tabIndex={-1}
                    title="Arrastrar para reordenar"
                    aria-label={`Mover tarjeta ${idx + 1}`}
                    onPointerDown={(e) => iniciarArrastre(e, idx)}
                    onPointerMove={moverArrastre}
                    onPointerUp={finalizarArrastre}
                    onPointerCancel={cancelarArrastre}
                  >
                    <IconoAgarre />
                  </span>
                </div>

                <Miniatura
                  tarjeta={t}
                  med={med}
                  obtenerLista={obtenerLista}
                  rev={revs?.[t.id] ?? 0}
                  renglones={renglones}
                  ancho={180}
                />

                <div className="nt-item-tarjeta__pie">
                  <span className="nt-item-tarjeta__titulo">{t.titulo || `Tarjeta ${idx + 1}`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
