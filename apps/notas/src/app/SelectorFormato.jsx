import { useState } from 'react';
import { FORMATOS, MODOS_ESCRITURA, crearDocumento, guardarDocumento } from '../almacen/index.js';
import { Modal } from './Modal.jsx';
import { normalizarPersonalizado } from '../formatos/tarjetas.js';

const OPCIONES = [
  { id: FORMATOS.PIZARRON, nombre: 'Pizarrón infinito', texto: 'Espacio libre para moverse en cualquier dirección.' },
  { id: FORMATOS.PAGINAS, nombre: 'Páginas A4', texto: 'Hojas una debajo de otra, como un documento.' },
  { id: FORMATOS.TARJETAS, nombre: 'Tarjetas', texto: 'Una idea por tarjeta, pensadas para imprimir.' },
];

export function Miniatura({ formato }) {
  return <div className="nt-mini"><i className={`nt-mini__${formato}`} /></div>;
}

export function SelectorFormato({ alCerrar, alCrear }) {
  const [formato, setFormato] = useState(FORMATOS.PIZARRON);
  const [titulo, setTitulo] = useState('Sin título');
  const [escritura, setEscritura] = useState(MODOS_ESCRITURA.AMBOS);
  const [estilo, setEstilo] = useState('rayado');
  const [tamano, setTamano] = useState('16:9');
  const [anchoMm, setAnchoMm] = useState(150);
  const [altoMm, setAltoMm] = useState(100);
  const [error, setError] = useState('');

  async function crear(e) {
    e.preventDefault();
    try {
      const persNorm = normalizarPersonalizado({ anchoMm, altoMm });
      const config = formato === FORMATOS.TARJETAS
        ? (tamano === 'personalizado' ? { tamano: 'personalizado', personalizado: persNorm } : { tamano })
        : {};
      const doc = await guardarDocumento(crearDocumento({ titulo: titulo.trim() || 'Sin título', formato, escritura, estiloRenglones: estilo, config }));
      alCrear(doc);
    } catch (err) { setError(err.message); }
  }

  return (
    <Modal titulo="Nueva nota" alCerrar={alCerrar} ancho={720}>
      <form onSubmit={crear}>
        <div className="nt-formatos" role="radiogroup" aria-label="Formato">
          {OPCIONES.map((o) => (
            <button type="button" key={o.id} role="radio" aria-checked={formato === o.id}
              className={`nt-formato ${formato === o.id ? 'nt-formato--sel' : ''}`} onClick={() => setFormato(o.id)}>
              <Miniatura formato={o.id} />
              <b>{o.nombre}</b><small>{o.texto}</small>
            </button>
          ))}
        </div>
        <div className="nt-fila nt-campos">
          <label>Título<input className="nt-campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} onFocus={(e) => e.target.select()} autoFocus /></label>
          <label>Escritura
            <select className="nt-campo" value={escritura} onChange={(e) => setEscritura(e.target.value)}>
              <option value={MODOS_ESCRITURA.AMBOS}>A mano y con teclado</option>
              <option value={MODOS_ESCRITURA.MANO}>Solo a mano</option>
              <option value={MODOS_ESCRITURA.TECLADO}>Solo con teclado</option>
            </select></label>
          <label>Renglones
            <select className="nt-campo" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
              <option value="rayado">Rayado</option><option value="cuadriculado">Cuadriculado</option>
              <option value="puntos">Puntos</option><option value="liso">Liso</option>
            </select></label>
          {formato === FORMATOS.TARJETAS && (
            <>
              <label>Tamaño de tarjeta
                <select className="nt-campo" value={tamano} onChange={(e) => setTamano(e.target.value)}>
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="A6">A6</option>
                  <option value="A5">A5</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </label>
              {tamano === 'personalizado' && (
                <>
                  <label>Ancho (mm)
                    <input
                      type="number"
                      className="nt-campo"
                      min={40}
                      max={400}
                      value={anchoMm}
                      onChange={(e) => setAnchoMm(e.target.value)}
                      onBlur={() => {
                        const norm = normalizarPersonalizado({ anchoMm, altoMm });
                        setAnchoMm(norm.anchoMm);
                        setAltoMm(norm.altoMm);
                      }}
                    />
                  </label>
                  <label>Alto (mm)
                    <input
                      type="number"
                      className="nt-campo"
                      min={40}
                      max={400}
                      value={altoMm}
                      onChange={(e) => setAltoMm(e.target.value)}
                      onBlur={() => {
                        const norm = normalizarPersonalizado({ anchoMm, altoMm });
                        setAnchoMm(norm.anchoMm);
                        setAltoMm(norm.altoMm);
                      }}
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>
        {error && <p className="nt-aviso" role="alert">{error}</p>}
        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="nt-btn nt-btn--primario">Crear nota</button>
        </div>
      </form>
    </Modal>
  );
}
