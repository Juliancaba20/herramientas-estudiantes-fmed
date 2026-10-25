import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { exportarDocumento } from '../archivos/exportar.js';
import { discoDelPrograma } from '../archivos/disco.js';
import { obtenerDocumento } from '../almacen/index.js';

// Al cerrar un documento que todavía no es un archivo del equipo (como al cerrar uno nuevo en Word):
// se ofrece guardarlo. Mientras tanto la nota está a salvo en la biblioteca de Anotomía.
export default function ModalGuardarComoArchivo({ doc, alCerrar }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setGuardando(true); setError('');
    try {
      const actual = (await obtenerDocumento(doc.id)) || doc;
      const r = await exportarDocumento(actual, { compartir: false });
      if (r.metodo === 'cancelado') { setGuardando(false); return; } // la persona cerró la ventana de guardar: se queda aquí
      alCerrar();
    } catch (e) { setError('No se pudo guardar el archivo: ' + (e?.message || e)); setGuardando(false); }
  }
  async function noPreguntarMas() {
    try { await discoDelPrograma().noPreguntarMas(doc.id); } catch { /* si no se pudo recordar, se vuelve a preguntar */ }
    alCerrar();
  }

  return (
    <Modal titulo="¿Guardar como archivo?" alCerrar={alCerrar} ancho={520}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <p style={{ margin: 0 }}>
          «{doc.titulo}» todavía no es un archivo de su equipo: hoy solo está en la biblioteca de Anotomía.
          Si la guarda como archivo, cada cambio que haga se escribirá también en él, y podrá abrirla con doble clic, copiarla o enviarla.
        </p>
        {error && <p className="nt-aviso nt-aviso--error" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="nt-acciones">
          <button type="button" className="nt-btn nt-btn--primario" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar como archivo…'}</button>
          <button type="button" className="nt-btn" disabled={guardando} onClick={alCerrar}>Ahora no</button>
        </div>
        <button type="button" className="nt-enlace" style={{ justifySelf: 'start' }} onClick={noPreguntarMas}>No volver a preguntar por esta nota</button>
      </div>
    </Modal>
  );
}
