// Componentes y constantes comunes compartidos entre editores (EditorLienzo, EditorTarjetas, EditorPaginas).

export const ICONOS = {
  seleccionar: 'M5 3l14 7-6 2-2 6z',
  mano: 'M8 13V6.5a1.5 1.5 0 013 0V11m0-1V4.5a1.5 1.5 0 013 0V11m0-2.5a1.5 1.5 0 013 0V16a6 6 0 01-6 6h-1a6 6 0 01-5-3l-3-5a1.5 1.5 0 012.5-1.5L8 15',
  lapiz: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
  resaltador: 'M9 15l7-7 3 3-7 7H9zM5 21h8',
  borrador: 'M4 16l9-9 6 6-5 5H8zM9 21h11',
  texto: 'M5 7V4h14v3M12 4v16M9 20h6',
  imagen: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 12 4-4 3 3 3-4 6 7M8 9h.01',
  mapa: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  frente: 'M12 19V7M6 12l6-6 6 6M5 3h14',
  subir: 'M12 19V6M6 12l6-6 6 6',
  bajar: 'M12 5v13M6 12l6 6 6-6',
  fondo: 'M12 5v12M6 12l6 6 6-6M5 21h14',
  eliminar: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  deshacer: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  rehacer: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z',
  anterior: 'M15 18l-6-6 6-6',
  siguiente: 'M9 18l6-6-6-6',
  duplicar: 'M8 7v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-8a2 2 0 00-2 2zM4 15V5a2 2 0 012-2h10',
  mas: 'M12 5v14M5 12h14',
  exportar: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
};

export const Icono = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

export function Boton({ icono, nombre, activo, deshabilitado, alPulsar, conservarFoco }) {
  return (
    <button className={`nt-ib ${activo ? 'nt-ib--on' : ''}`} title={nombre} aria-label={nombre} aria-pressed={activo === undefined ? undefined : activo}
      disabled={deshabilitado} onMouseDown={conservarFoco ? (e) => e.preventDefault() : undefined} onClick={alPulsar}><Icono d={ICONOS[icono]} /></button>
  );
}

export const COLORES = [['#14192b', 'Negro'], ['#2350d8', 'Azul'], ['#d6336c', 'Rosa'], ['#1f9d55', 'Verde'], ['#e67700', 'Naranja'], ['#7048e8', 'Violeta'], ['#868e96', 'Gris'], ['#ffd84d', 'Amarillo']];

export function Propiedades({ ui, motorRef }) {
  const h = ui.herramienta;
  const a = ui.ajustes[h];
  const cfg = (parche) => motorRef.current.configurar(h, parche);
  return (
    <div className="nt-props" role="group" aria-label="Opciones de la herramienta">
      {h === 'borrador' ? (
        <>
          <div className="nt-seg" role="radiogroup" aria-label="Modo del borrador">
            <button role="radio" aria-checked={a.modo === 'trazo'} className={a.modo === 'trazo' ? 'nt-seg--on' : ''} onClick={() => cfg({ modo: 'trazo' })}>Trazo completo</button>
            <button role="radio" aria-checked={a.modo === 'zona'} className={a.modo === 'zona' ? 'nt-seg--on' : ''} onClick={() => cfg({ modo: 'zona' })}>Por zona</button>
          </div>
          <label className="nt-rango">Tamaño<input type="range" min="10" max="90" value={a.tamano} onChange={(e) => cfg({ tamano: +e.target.value })} /></label>
        </>
      ) : (
        <>
          <div className="nt-colores" role="radiogroup" aria-label="Color">
            {COLORES.map(([c, n]) => (
              <button key={c} role="radio" aria-checked={a.color === c} aria-label={n} title={n}
                className={`nt-color ${a.color === c ? 'nt-color--on' : ''}`} style={{ background: c }} onClick={() => cfg({ color: c })} />
            ))}
          </div>
          <label className="nt-rango">Grosor<input type="range" min="1" max="40" value={a.grosor} onChange={(e) => cfg({ grosor: +e.target.value })} /></label>
          <label className="nt-rango">Opacidad<input type="range" min="10" max="100" value={Math.round(a.opacidad * 100)} onChange={(e) => cfg({ opacidad: +e.target.value / 100 })} /></label>
        </>
      )}
      <label className="nt-check"><input type="checkbox" checked={ui.dedoDibuja} onChange={(e) => motorRef.current.setDedoDibuja(e.target.checked)} />
        Dibujar con el dedo{ui.hayLapiz ? '' : ' (si usa lápiz, desactívelo para apoyar la mano)'}</label>
    </div>
  );
}

export const TEXTO_ESTADO = { 'sin-cambios': '', pendiente: 'Cambios sin guardar…', guardando: 'Guardando…', guardado: 'Guardado ✓', error: 'No se pudo guardar', 'error-espacio': 'Sin espacio en el dispositivo' };
