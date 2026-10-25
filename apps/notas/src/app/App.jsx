import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listarDocumentos, purgarBlobsSinReferencia, purgarPapeleraVieja,
  obtenerAjuste, guardarAjuste, obtenerDocumento, EVENTO_ESPACIO_LLENO,
} from '../almacen/index.js';
import Biblioteca from './Biblioteca.jsx';
import Papelera from './Papelera.jsx';
import AvisoPWA from './AvisoPWA.jsx';
import EditorLienzo from './EditorLienzo.jsx';
import EditorTarjetas from '../formatos/EditorTarjetas.jsx';
import EditorPaginas from '../formatos/EditorPaginas.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import ModalBienvenida from './ModalBienvenida.jsx';
import ModalAyuda from './ModalAyuda.jsx';
import { Modal } from './Modal.jsx';
import GuardadoEnArchivos from './GuardadoEnArchivos.jsx';
import AvisoProgramaNuevo from './AvisoProgramaNuevo.jsx';
import ModalGuardarComoArchivo from './ModalGuardarComoArchivo.jsx';
import { esProgramaDeComputadora } from '../pwa/escritorio.js';
import { discoDelPrograma } from '../archivos/disco.js';
import { guardarTodoAntesDeActualizar } from '../pwa/actualizador.js';

export default function App() {
  const [pantalla, setPantalla] = useState('biblioteca');
  const [doc, setDoc] = useState(null);
  const [enPapelera, setEnPapelera] = useState(0);
  const [bienvenidaVisible, setBienvenidaVisible] = useState(false);
  const [ayudaVisible, setAyudaVisible] = useState(false);
  const [espacioLlenoAviso, setEspacioLlenoAviso] = useState(false);
  const enComputadora = esProgramaDeComputadora(); // programa de Windows, Mac o Linux: archivos reales en el disco
  const [archivosParaAbrir, setArchivosParaAbrir] = useState([]); // archivos .nota que llegan desde fuera (doble clic)
  const [preguntarArchivo, setPreguntarArchivo] = useState(null); // documento recién cerrado que aún no es un archivo
  const pantallaRef = useRef(pantalla);
  useEffect(() => { pantallaRef.current = pantalla; });

  const contarPapelera = useCallback(async () => {
    try { setEnPapelera((await listarDocumentos({ papelera: true })).length); } catch { /* se informa en cada pantalla */ }
  }, []);

  useEffect(() => {
    Promise.all([purgarPapeleraVieja(30), purgarBlobsSinReferencia()]).catch(() => {}).then(contarPapelera);
  }, [contarPapelera]);

  // Comprobar si es la primera vez que se abre la app
  useEffect(() => {
    (async () => {
      try {
        const vista = await obtenerAjuste('bienvenida.vista', false);
        if (!vista) setBienvenidaVisible(true);
      } catch {
        /* ignorar fallo de lectura */
      }
    })();
  }, []);

  // Escuchar evento de espacio lleno (QuotaExceededError)
  useEffect(() => {
    const alLleno = () => setEspacioLlenoAviso(true);
    window.addEventListener(EVENTO_ESPACIO_LLENO, alLleno);
    return () => window.removeEventListener(EVENTO_ESPACIO_LLENO, alLleno);
  }, []);

  // Cierre de un documento. En el programa de computadora, si todavía no es un archivo del equipo se ofrece guardarlo
  // (solo si se llegó a escribir algo: un documento recién creado y vacío no molesta).
  const volverALaBiblioteca = useCallback(async () => {
    const cerrado = doc;
    setPantalla('biblioteca');
    if (!enComputadora || !cerrado) return;
    try {
      const actual = await obtenerDocumento(cerrado.id);
      if (actual && !actual.papelera && actual.modificado > actual.creado && await discoDelPrograma().debePreguntar(actual.id)) setPreguntarArchivo(actual);
    } catch { /* si no se puede consultar, no se pregunta */ }
  }, [doc, enComputadora]);

  // Un .nota que se abre desde fuera: se guarda lo que haya en el editor y se entra por la biblioteca
  const abrirArchivosExternos = useCallback(async (archivos) => {
    if (pantallaRef.current !== 'biblioteca') {
      await guardarTodoAntesDeActualizar(window, () => discoDelPrograma().vaciar()).catch(() => {});
      setPantalla('biblioteca');
    }
    setArchivosParaAbrir(archivos);
  }, []);
  const consumirArchivosParaAbrir = useCallback(() => setArchivosParaAbrir([]), []);

  const cerrarBienvenida = async () => {
    setBienvenidaVisible(false);
    try {
      await guardarAjuste('bienvenida.vista', true);
    } catch {
      /* ignorar fallo */
    }
  };

  return (
    <ErrorBoundary>
      <div className="nt-raiz">
        {pantalla === 'biblioteca' && (
          <Biblioteca
            abrirDocumento={(d) => { setDoc(d); setPantalla('editor'); }}
            irAPapelera={() => setPantalla('papelera')}
            cantidadPapelera={enPapelera}
            avisarCambio={contarPapelera}
            abrirAyuda={() => setAyudaVisible(true)}
            archivosParaAbrir={archivosParaAbrir}
            consumirArchivosParaAbrir={consumirArchivosParaAbrir}
          />
        )}
        {pantalla === 'papelera' && <Papelera volver={() => setPantalla('biblioteca')} avisarCambio={contarPapelera} />}
        {pantalla === 'editor' && doc && (doc.formato === 'paginas'
          ? <EditorPaginas key={doc.id} doc={doc} volver={volverALaBiblioteca} />
          : doc.formato === 'tarjetas'
            ? <EditorTarjetas key={doc.id} doc={doc} volver={volverALaBiblioteca} />
            : <EditorLienzo key={doc.id} doc={doc} volver={volverALaBiblioteca} />)}
        <AvisoPWA />
        {enComputadora && <AvisoProgramaNuevo />}
        {enComputadora && <GuardadoEnArchivos pantalla={pantalla} doc={doc} alAbrirArchivos={abrirArchivosExternos} />}
        {preguntarArchivo && <ModalGuardarComoArchivo doc={preguntarArchivo} alCerrar={() => setPreguntarArchivo(null)} />}

        {bienvenidaVisible && <ModalBienvenida alComenzar={cerrarBienvenida} />}
        {ayudaVisible && <ModalAyuda alCerrar={() => setAyudaVisible(false)} />}

        {espacioLlenoAviso && (
          <Modal titulo="Almacenamiento lleno (Cuota excedida)" alCerrar={() => setEspacioLlenoAviso(false)} ancho={500}>
            <div style={{ display: 'grid', gap: '14px' }}>
              <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>
                El espacio de almacenamiento asignado por el navegador se ha completado.
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                Sus modificaciones actuales se conservan en la memoria de la sesión para evitar pérdida de datos. Le sugerimos exportar una copia de seguridad de sus documentos (.anotomia-respaldo) y vaciar la papelera para recuperar espacio disponible.
              </p>
              <div className="nt-acciones">
                <button type="button" className="nt-btn nt-btn--primario" onClick={() => setEspacioLlenoAviso(false)}>
                  Entendido
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
