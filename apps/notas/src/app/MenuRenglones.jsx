import { useEffect, useRef, useState } from 'react';

// Renglones (Etapa 8): botón de encendido y panel de opciones. Todo es fondo: nada de lo escrito se mueve.
const ESTILOS = [['rayado', 'Rayado'], ['cuadriculado', 'Cuadriculado'], ['puntos', 'Puntos'], ['liso', 'Liso']];
const MODOS = [['siempre', 'Siempre visibles'], ['breve', 'Aparecen un momento'], ['ocultos', 'Ocultos']];
const COLORES = [['#2350d8', 'Azul'], ['#14192b', 'Negro'], ['#868e96', 'Gris'], ['#1f9d55', 'Verde'], ['#d6336c', 'Rosa'], ['#e67700', 'Naranja']];
const I = (d) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

export default function MenuRenglones({ renglones: r, motorRef }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const panel = useRef(null);
  const cfg = (parche, previa = true) => motorRef.current?.configurarRenglones(parche, { previa });

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (!panel.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  function abrir() {
    if (abierto) { setAbierto(false); return; }
    const b = boton.current.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(b.left, window.innerWidth - 328)), bottom: window.innerHeight - b.top + 8 });
    setAbierto(true);
  }

  return (
    <>
      <button className={`nt-ib ${r.activos && r.estilo !== 'liso' ? 'nt-ib--on' : ''}`} title="Renglones: encender o apagar (Alt+G)" aria-label="Renglones" aria-pressed={r.activos}
        onClick={() => motorRef.current?.alternarRenglones()}>{I('M4 7h16M4 12h16M4 17h16')}</button>
      <button ref={boton} className="nt-ib nt-ib--chico" title="Opciones de los renglones" aria-label="Opciones de los renglones" aria-haspopup="dialog" aria-expanded={abierto} onClick={abrir}>{I('M6 15l6-6 6 6')}</button>
      {abierto && (
        <div ref={panel} className="nt-panel-renglones" role="dialog" aria-label="Renglones" style={pos}>
          <label className="nt-interruptor"><input type="checkbox" checked={r.activos} onChange={(e) => cfg({ activos: e.target.checked }, false)} /> Renglones activados</label>
          <div className="nt-seg" role="group" aria-label="Estilo">
            {ESTILOS.map(([k, n]) => <button key={k} type="button" aria-pressed={r.estilo === k} className={`nt-btn ${r.estilo === k ? 'nt-btn--on' : ''}`} onClick={() => cfg({ estilo: k })}>{n}</button>)}
          </div>
          <label className="nt-rango">Separación<input type="range" min="16" max="96" step="2" value={r.interlineado} onChange={(e) => cfg({ interlineado: +e.target.value })} /><span>{r.interlineado}</span></label>
          <label className="nt-rango">Intensidad<input type="range" min="5" max="100" value={Math.round(r.intensidad * 100)} onChange={(e) => cfg({ intensidad: +e.target.value / 100 })} /><span>{Math.round(r.intensidad * 100)} %</span></label>
          <div className="nt-colores" role="group" aria-label="Color">
            {COLORES.map(([c, n]) => <button key={c} type="button" aria-pressed={r.color === c} aria-label={n} title={n} className={`nt-color ${r.color === c ? 'nt-color--on' : ''}`} style={{ background: c }} onClick={() => cfg({ color: c })} />)}
          </div>
          <fieldset className="nt-modos"><legend>Visibilidad</legend>
            {MODOS.map(([k, n]) => <label key={k}><input type="radio" name="nt-modo-renglones" checked={r.modo === k} onChange={() => cfg({ modo: k }, true)} /> {n}</label>)}
            {r.modo === 'breve' && (
              <span className="nt-duracion">Durante <label><input type="radio" name="nt-dur-renglones" checked={r.duracion === 1} onChange={() => cfg({ duracion: 1 })} /> 1 s</label> <label><input type="radio" name="nt-dur-renglones" checked={r.duracion === 2} onChange={() => cfg({ duracion: 2 })} /> 2 s</label></span>
            )}
            {r.modo !== 'siempre' && <button type="button" className="nt-btn" onClick={() => motorRef.current?.mostrarRenglones()}>Mostrar ahora</button>}
          </fieldset>
          <label className="nt-interruptor"><input type="checkbox" checked={r.alinear} onChange={(e) => cfg({ alinear: e.target.checked }, false)} /> Alinear al renglón <small>acomoda lo nuevo y lo que mueva a la guía</small></label>
        </div>
      )}
    </>
  );
}
