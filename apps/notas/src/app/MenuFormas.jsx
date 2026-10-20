import { useEffect, useRef, useState } from 'react';
import { ES_FORMA, ICONOS_FORMA, LISTA_FORMAS, NOMBRES_FORMA } from './formas.js';

// Menú de formas básicas (Etapa 7). El botón del riel muestra la última forma usada;
// el menú se coloca con position: fixed para que el riel no lo recorte.
export default function MenuFormas({ herramienta, ultima, alElegir }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  function abrir() {
    if (abierto) { setAbierto(false); return; }
    const r = boton.current.getBoundingClientRect();
    const angosto = window.innerWidth <= 640; // en el celular el riel está abajo: el menú sube
    setPos(angosto ? { left: Math.max(8, r.left), bottom: window.innerHeight - r.top + 8 } : { left: r.right + 8, top: r.top });
    setAbierto(true);
  }

  const activa = ES_FORMA(herramienta);
  const forma = activa ? herramienta : ultima;
  return (
    <>
      <button ref={boton} className={`nt-ib ${activa ? 'nt-ib--on' : ''}`} title={`Formas: ${NOMBRES_FORMA[forma]}`} aria-label="Formas" aria-haspopup="menu" aria-expanded={abierto} onClick={abrir}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS_FORMA[forma]} /></svg>
      </button>
      {abierto && (
        <div ref={menu} className="nt-menu-formas" role="menu" aria-label="Formas básicas" style={pos}>
          {LISTA_FORMAS.map(([k, n, d]) => (
            <button key={k} role="menuitemradio" aria-checked={herramienta === k} className={`nt-ib ${herramienta === k ? 'nt-ib--on' : ''}`} title={n} aria-label={n}
              onClick={() => { alElegir(k); setAbierto(false); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg></button>
          ))}
        </div>
      )}
    </>
  );
}
