// Estilo de las figuras (Etapa 7): borde, relleno y grosor. Cambia las figuras seleccionadas
// y también las que se creen después.
const BORDES = [['#14192b', 'Negro'], ['#2350d8', 'Azul'], ['#d6336c', 'Rosa'], ['#1f9d55', 'Verde'], ['#e67700', 'Naranja'], ['#7048e8', 'Violeta'], ['#868e96', 'Gris']];
const RELLENOS = [['#cfdcff', 'Azul claro'], ['#ffe9a8', 'Amarillo claro'], ['#c9f0d8', 'Verde claro'], ['#ffd3dc', 'Rosa claro'], ['#e3d6ff', 'Violeta claro'], ['#ffffff', 'Blanco']];

export default function PanelFigura({ estilo, motorRef }) {
  const cambiar = (parche) => motorRef.current.estiloFiguras(parche);
  return (
    <div className="nt-props" role="group" aria-label="Estilo de la figura">
      <div className="nt-colores" role="group" aria-label="Color del borde">
        {BORDES.map(([c, n]) => (
          <button key={c} type="button" aria-pressed={estilo.borde === c} aria-label={`Borde ${n.toLowerCase()}`} title={`Borde ${n.toLowerCase()}`}
            className={`nt-color ${estilo.borde === c ? 'nt-color--on' : ''}`} style={{ background: c }} onClick={() => cambiar({ borde: c })} />
        ))}
      </div>
      {!estilo.linea && (
        <div className="nt-colores" role="group" aria-label="Relleno">
          <button type="button" aria-pressed={!estilo.relleno} aria-label="Sin relleno" title="Sin relleno" className={`nt-color nt-color--vacio ${!estilo.relleno ? 'nt-color--on' : ''}`} onClick={() => cambiar({ relleno: null })}>∅</button>
          {RELLENOS.map(([c, n]) => (
            <button key={c} type="button" aria-pressed={estilo.relleno === c} aria-label={`Relleno ${n.toLowerCase()}`} title={`Relleno ${n.toLowerCase()}`}
              className={`nt-color ${estilo.relleno === c ? 'nt-color--on' : ''}`} style={{ background: c }} onClick={() => cambiar({ relleno: c })} />
          ))}
        </div>
      )}
      <label className="nt-rango">Grosor<input type="range" min="1" max="20" value={estilo.grosor} onChange={(e) => cambiar({ grosor: +e.target.value })} /></label>
    </div>
  );
}
