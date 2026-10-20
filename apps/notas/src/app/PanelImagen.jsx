export default function PanelImagen({ imagen, motorRef }) {
  const motor = () => motorRef.current;
  const r = imagen.recorte || { x: 0, y: 0, ancho: 1, alto: 1 };
  const cambiar = (campo, valor) => {
    let siguiente = { ...r, [campo]: valor / 100 };
    if (campo === 'x') siguiente.ancho = Math.min(r.ancho, 1 - siguiente.x);
    if (campo === 'y') siguiente.alto = Math.min(r.alto, 1 - siguiente.y);
    motor()?.recortarImagen(siguiente);
  };
  const control = (campo, nombre, valor, max) => (
    <label className="nt-rango" key={campo}>{nombre}<input type="range" min="0" max={max} value={Math.round(valor * 100)}
      aria-label={`Recorte ${nombre}`}
      onPointerDown={() => motor()?.iniciarRecorteImagen()} onPointerUp={() => motor()?.terminarRecorteImagen()}
      onPointerCancel={() => motor()?.terminarRecorteImagen()} onBlur={() => motor()?.terminarRecorteImagen()}
      onChange={(e) => cambiar(campo, +e.target.value)} /></label>
  );
  return (
    <div className="nt-props nt-panel-imagen" role="group" aria-label="Recorte de imagen">
      <span className="nt-panel-imagen__nombre" title={imagen.nombre}>{imagen.nombre}</span>
      {control('x', 'Izquierda', r.x, Math.floor((1 - r.ancho) * 100))}
      {control('y', 'Arriba', r.y, Math.floor((1 - r.alto) * 100))}
      {control('ancho', 'Ancho visible', r.ancho, Math.floor((1 - r.x) * 100))}
      {control('alto', 'Alto visible', r.alto, Math.floor((1 - r.y) * 100))}
      <button type="button" className="nt-btn" aria-label="Restablecer recorte a la imagen completa" onClick={() => { motor()?.iniciarRecorteImagen(); motor()?.recortarImagen({ x: 0, y: 0, ancho: 1, alto: 1 }); motor()?.terminarRecorteImagen(); }}>Restablecer</button>
    </div>
  );
}
