import { Modal } from './Modal.jsx';

export default function ModalBienvenida({ alComenzar }) {
  return (
    <Modal titulo="Bienvenido a Anotomía" alCerrar={alComenzar} ancho={520}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong>Anotomía</strong> es su aplicación de notas y estudio personal.
          Sus documentos viven únicamente en su dispositivo (mediante IndexedDB local); no requiere cuentas ni conexión a servidores externos.
        </p>

        <div style={{ display: 'grid', gap: '10px', background: 'var(--nt-azul-claro)', padding: '14px', borderRadius: '10px', fontSize: '13px' }}>
          <div>
            <strong>1. Pizarrón infinito:</strong> Lienzo libre sin límites para esquemas, trazos libres y mapas mentales.
          </div>
          <div>
            <strong>2. Páginas A4:</strong> Hojas continuas verticales optimizadas para redacción formal, impresión y PDF.
          </div>
          <div>
            <strong>3. Tarjetas de estudio:</strong> Fichas organizadas para memorización y repaso ágil en modo pantalla completa.
          </div>
        </div>

        <p className="nt-texto-suave" style={{ margin: 0, fontSize: '12px' }}>
          Sugerencia: Recuerde utilizar periódicamente la función de <em>Copias de seguridad</em> desde la biblioteca para resguardar sus notas en un archivo descargable.
        </p>

        <div className="nt-acciones" style={{ marginTop: '4px' }}>
          <button type="button" className="nt-btn nt-btn--primario" onClick={alComenzar}>
            Comenzar a usar Anotomía
          </button>
        </div>
      </div>
    </Modal>
  );
}
