import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { usePWA } from '../pwa/pwa.js';
import { PROGRAMAS, ofertaDeInstalacion, urlDescarga, consultarPublicacion, hayProgramaPublicado } from '../pwa/escritorio.js';
import { DESCRIPCION, PRIMERA_VEZ, DONDE_GUARDA, ACTUALIZACION, NOTAS_DEL_NAVEGADOR } from '../pwa/textosProgramas.js';

// Qué se ofrece depende del dispositivo (ver src/pwa/escritorio.js):
//  · Windows 10/11, Mac, Linux y Android: la única descarga es el programa de ese sistema (.exe, .dmg, .AppImage, .apk).
//  · El resto (iPad, iPhone, Chromebook, Windows antiguo…): la instalación de la versión web.
export default function ModalInstalar({ alCerrar }) {
  const oferta = ofertaDeInstalacion();
  const [publicacion, setPublicacion] = useState(null); // null mientras se consulta
  const esPrograma = oferta.tipo === 'programa';

  useEffect(() => {
    if (!esPrograma) return undefined;
    let vivo = true;
    consultarPublicacion().then((p) => { if (vivo) setPublicacion(p); });
    return () => { vivo = false; };
  }, [esPrograma]);

  const sinPublicar = esPrograma && publicacion && !hayProgramaPublicado(publicacion, oferta.plataforma);
  const titulo = esPrograma && !sinPublicar ? `Descargar Anotomía para ${PROGRAMAS[oferta.plataforma].nombre}` : 'Instalar Anotomía';

  return (
    <Modal titulo={titulo} alCerrar={alCerrar} ancho={600}>
      {oferta.tipo === 'instalado' && <ProgramaInstalado alCerrar={alCerrar} />}
      {esPrograma && !sinPublicar && <DescargarPrograma plataforma={oferta.plataforma} alCerrar={alCerrar} />}
      {(oferta.tipo === 'web' || sinPublicar) && (
        <InstalarWeb alCerrar={alCerrar} aviso={sinPublicar ? `El programa para ${PROGRAMAS[oferta.plataforma].nombre} todavía no está publicado. Mientras tanto puede instalar la versión web.` : ''} />
      )}
    </Modal>
  );
}

function ProgramaInstalado({ alCerrar }) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <p className="nt-aviso nt-aviso--ok" style={{ margin: 0 }}>Está usando el programa de Anotomía. No hay nada más que instalar.</p>
      <div className="nt-acciones"><button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button></div>
    </div>
  );
}

// Windows 10/11, Mac, Linux o Android: se descarga el programa de ese sistema.
function DescargarPrograma({ plataforma, alCerrar }) {
  const { nombre, tipo } = PROGRAMAS[plataforma];
  const grupo = plataforma === 'android' ? 'android' : 'computadora';
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <p className="nt-texto-suave" style={{ margin: 0 }}>{DESCRIPCION[plataforma]} {DONDE_GUARDA[grupo]}</p>
      <div>
        <a className="nt-btn nt-btn--primario" href={urlDescarga(plataforma)}
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Descargar para {nombre} ({tipo})</a>
      </div>
      <section className="nt-instrucciones">
        <h3>Para instalarlo</h3>
        <ol>{PRIMERA_VEZ[plataforma].map((paso) => <li key={paso}>{paso}</li>)}</ol>
      </section>
      <section className="nt-instrucciones">
        <h3>Actualizaciones</h3>
        <p className="nt-texto-suave" style={{ margin: 0 }}>{ACTUALIZACION[grupo]}</p>
      </section>
      <section className="nt-instrucciones">
        <h3>Si ya tiene notas en el navegador</h3>
        <p className="nt-texto-suave" style={{ margin: 0 }}>{NOTAS_DEL_NAVEGADOR}</p>
      </section>
      <div className="nt-acciones"><button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button></div>
    </div>
  );
}

// iPad, iPhone, Chromebook, Windows no compatible o programa aún sin publicar: instalación de la versión web.
function InstalarWeb({ alCerrar, aviso }) {
  const { instalable, instalada, instalar, sinConexion } = usePWA();
  const [resultado, setResultado] = useState('');

  async function instalarAhora() {
    const r = await instalar();
    if (r === 'accepted') setResultado('La instalación se completó. Puede abrir Anotomía desde su escritorio o pantalla de inicio.');
    else if (r === 'dismissed') setResultado('Se canceló la instalación. Puede volver a intentarlo cuando lo desee.');
  }

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {aviso && <p className="nt-aviso" role="note" style={{ margin: 0 }}>{aviso}</p>}
      {instalada ? (
        <p className="nt-aviso nt-aviso--ok" style={{ margin: 0 }}>Anotomía ya está instalada en este dispositivo y se abre como una aplicación.</p>
      ) : (
        <p className="nt-texto-suave" style={{ margin: 0 }}>
          Para este dispositivo Anotomía se instala desde el navegador. Instalada, se abre como una aplicación propia y <strong>funciona sin conexión a internet</strong>.
          Sus notas siguen guardándose únicamente en este dispositivo.
        </p>
      )}
      {sinConexion && <p className="nt-texto-suave" style={{ margin: 0 }}>Ahora mismo no hay conexión: la app sigue funcionando con normalidad.</p>}
      {instalable && !instalada && (
        <div><button type="button" className="nt-btn nt-btn--primario" onClick={instalarAhora}>Instalar ahora</button></div>
      )}
      {resultado && <p className="nt-aviso nt-aviso--ok" role="status" style={{ margin: 0 }}>{resultado}</p>}

      <section className="nt-instrucciones">
        <h3>En una computadora (Chrome o Edge)</h3>
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
  );
}
