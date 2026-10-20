import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { usePWA } from '../pwa/pwa.js';

// Instrucciones de instalación para PC, Android e iPad, y botón directo cuando el navegador lo permite.
export default function ModalInstalar({ alCerrar }) {
  const { instalable, instalada, instalar, sinConexion } = usePWA();
  const [resultado, setResultado] = useState('');

  async function instalarAhora() {
    const r = await instalar();
    if (r === 'accepted') setResultado('La instalación se completó. Puede abrir Anotomía desde su escritorio o pantalla de inicio.');
    else if (r === 'dismissed') setResultado('Se canceló la instalación. Puede volver a intentarlo cuando lo desee.');
  }

  return (
    <Modal titulo="Instalar Anotomía" alCerrar={alCerrar} ancho={600}>
      <div style={{ display: 'grid', gap: '14px' }}>
        {instalada ? (
          <p className="nt-aviso nt-aviso--ok" style={{ margin: 0 }}>Anotomía ya está instalada en este dispositivo y se abre como una aplicación.</p>
        ) : (
          <p className="nt-texto-suave" style={{ margin: 0 }}>
            Instalada, Anotomía se abre como una aplicación propia y <strong>funciona sin conexión a internet</strong>.
            Sus notas siguen guardándose únicamente en este dispositivo.
          </p>
        )}
        {sinConexion && <p className="nt-texto-suave" style={{ margin: 0 }}>Ahora mismo no hay conexión: la app sigue funcionando con normalidad.</p>}
        {instalable && !instalada && (
          <div><button type="button" className="nt-btn nt-btn--primario" onClick={instalarAhora}>Instalar ahora</button></div>
        )}
        {resultado && <p className="nt-aviso nt-aviso--ok" role="status" style={{ margin: 0 }}>{resultado}</p>}

        <section className="nt-instrucciones">
          <h3>En una PC (Chrome o Edge)</h3>
          <ol>
            <li>Abra Anotomía en el navegador.</li>
            <li>Pulse el ícono de instalación que aparece a la derecha de la barra de direcciones, o abra el menú ⋮ y elija «Instalar Anotomía».</li>
            <li>Confirme con «Instalar». Se abrirá en su propia ventana.</li>
          </ol>
        </section>
        <section className="nt-instrucciones">
          <h3>En Android (Chrome)</h3>
          <ol>
            <li>Abra Anotomía en Chrome.</li>
            <li>Abra el menú ⋮ y elija «Instalar aplicación» (o «Agregar a la pantalla principal»).</li>
            <li>Confirme. El ícono aparecerá en la pantalla de inicio.</li>
          </ol>
        </section>
        <section className="nt-instrucciones">
          <h3>En un iPad o iPhone (Safari)</h3>
          <ol>
            <li>Abra Anotomía en <strong>Safari</strong> (otros navegadores no permiten instalar en iPad).</li>
            <li>Pulse el botón Compartir (el cuadrado con una flecha hacia arriba).</li>
            <li>Elija «Agregar a pantalla de inicio» y luego «Agregar».</li>
          </ol>
          <p className="nt-texto-suave" style={{ margin: '6px 0 0' }}>
            Recomendado: en iPad, Safari puede borrar los datos de los sitios que se usan poco. Instalada en la pantalla de inicio,
            la app queda protegida. Aun así, haga copias de seguridad periódicas desde «Copias y espacio».
          </p>
        </section>
        <div className="nt-acciones"><button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button></div>
      </div>
    </Modal>
  );
}
