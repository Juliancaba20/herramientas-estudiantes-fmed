import { useEffect, useRef, useState } from 'react';
import {
  crearAutoguardado, guardarAjuste, guardarDocumento, guardarPendientesDeEscena, listarElementos, obtenerAjuste,
} from '../almacen/index.js';
import { exportarDocumento } from '../archivos/exportar.js';
import { Escena } from '../lienzo/escena.js';
import { Lienzo } from '../lienzo/motor.js';
import { encuadrar } from '../lienzo/camara.js';
import { dibujar } from '../lienzo/dibujo.js';
import { ALTO_A4, ANCHO_A4 } from '../formatos/paginas.js';
import { construirHojasPizarron, imprimirContenedor } from '../formatos/impresion.js';
import { prepararImagenes } from '../herramientas/imagenes/recursos.js';
import BarraTexto from './BarraTexto.jsx';
import Minimapa from './Minimapa.jsx';
import MenuRenglones from './MenuRenglones.jsx';
import MenuFormas from './MenuFormas.jsx';
import { ES_FORMA } from './formas.js';
import PanelFigura from './PanelFigura.jsx';
import PanelImagen from './PanelImagen.jsx';
import InsertarImagen from './InsertarImagen.jsx';
import { Modal } from './Modal.jsx';
import {
  Boton, Propiedades, TEXTO_ESTADO,
} from './EditorComun.jsx';

export default function EditorLienzo({ doc, volver }) {
  const canvasRef = useRef(null);
  const capaTextoRef = useRef(null);
  const motorRef = useRef(null);
  const autoRef = useRef(null);
  const docRef = useRef({ ...doc });
  const tituloSucio = useRef(false);
  const [titulo, setTitulo] = useState(doc.titulo);
  const [ui, setUi] = useState(null);
  const [estado, setEstado] = useState('sin-cambios');
  const [error, setError] = useState('');
  const [ultimaForma, setUltimaForma] = useState('rectangulo');
  const [modalImprimir, setModalImprimir] = useState(false);
  const [imprimirRenglones, setImprimirRenglones] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let vivo = true;
    let motor; let auto; let baja = () => {}; let bajaEstado = () => {};
    (async () => {
      let elementos;
      try { elementos = await listarElementos(doc.id); } catch (e) { setError(e.message); return; }
      if (!vivo) return;
      const escena = new Escena(elementos);
      auto = crearAutoguardado(async () => {
        motorRef.current?.finalizarGestoEnCurso();
        motorRef.current?.puntoDeControlTexto(); // el texto que se está escribiendo entra en lo que se guarda
        await guardarPendientesDeEscena(() => escena, undefined, async ({ guardados, borrados }) => {
          const hayContenido = guardados > 0 || borrados > 0 || tituloSucio.current;
          tituloSucio.current = false;
          await guardarDocumento(docRef.current, { tocarFecha: hayContenido });
        });
      }, { espera: 700 });
      autoRef.current = auto;
      bajaEstado = auto.suscribir(setEstado);
      baja = escena.suscribir(() => auto.programar());
      let ajustes = null;
      try { ajustes = await obtenerAjuste('lienzo.ajustes', null); } catch { /* se usan los valores por defecto */ }
      if (!vivo) { auto.destruir(); return; }
      motor = new Lienzo(canvasRef.current, {
        escena, documentoId: doc.id, camara: doc.config?.camara, ajustes, capaTexto: capaTextoRef.current, escritura: doc.escritura, renglones: doc.renglones,
        alRenglones: (r) => { docRef.current = { ...docRef.current, renglones: r }; auto.programar(); },
        alAjustes: (a) => { guardarAjuste('lienzo.ajustes', a).catch(() => {}); },
        alCambiar: setUi,
        alImagenError: setError,
        alCamara: (c) => { docRef.current = { ...docRef.current, config: { ...docRef.current.config, camara: { ...c } } }; auto.programar(); },
      });
      motorRef.current = motor;
      motor._notificar();
    })();
    return () => { vivo = false; baja(); bajaEstado(); motor?.destruir(); auto?.destruir(); };
  }, [doc]);

  async function salir() {
    motorRef.current?.finalizarGestoEnCurso();
    motorRef.current?.cerrarTexto(); // lo escrito pasa a la escena antes de guardar
    try { await autoRef.current?.vaciar(); } catch { /* el estado de error ya se muestra */ }
    volver();
  }

  function cambiarTitulo(v) {
    setTitulo(v);
    docRef.current = { ...docRef.current, titulo: v.trim() || 'Sin título' };
    tituloSucio.current = true;
    autoRef.current?.programar();
  }

  async function ejecutarExportar() {
    if (exportando) return;
    setExportando(true);
    try {
      motorRef.current?.cerrarTexto();
      await autoRef.current?.vaciar();
      const elementos = motorRef.current ? motorRef.current.escena.lista() : null;
      await exportarDocumento(docRef.current, { elementos, compartir: true });
    } catch (err) {
      setError('No se pudo exportar la nota: ' + err.message);
    } finally {
      setExportando(false);
    }
  }

  async function ejecutarImpresion() {
    const cont = document.getElementById('nt-area-impresion-pizarron');
    if (!cont || !motorRef.current) return;
    const motor = motorRef.current;
    motor.cerrarTexto();
    const listaCompleta = motor.escena.lista();
    const recursosImagen = await prepararImagenes(listaCompleta);

    const factor = 2;
    try {
      construirHojasPizarron(cont, {
        titulo: docRef.current.titulo || doc.titulo,
        factor,
        dibujarEn: (cv, factorDpr) => {
          const cx = cv.getContext('2d');
          const limites = motor.escena.limites(listaCompleta) || { minX: -400, minY: -300, maxX: 400, maxY: 300 };
          const cam = encuadrar(limites, ANCHO_A4, ALTO_A4, { margen: 40 });
          dibujar(cx, {
            camara: cam,
            ancho: ANCHO_A4,
            alto: ALTO_A4,
            dpr: factorDpr,
            lista: listaCompleta,
            escena: motor.escena,
            seleccion: new Set(),
            marco: null,
            mostrarManijas: null,
            renglones: imprimirRenglones ? { cfg: docRef.current.renglones, opacidad: 1 } : null,
            guiaTexto: docRef.current.renglones,
            marcoDocumento: null,
          });
        },
      });
    } finally {
      recursosImagen.liberar();
    }
    setModalImprimir(false);
    imprimirContenedor(cont);
  }

  return (
    <div className="nt-editor">
      <header className="nt-ed-cab">
        <button className="nt-btn" onClick={salir}>← Biblioteca</button>
        <input className="nt-ed-titulo" aria-label="Título" value={titulo} onChange={(e) => cambiarTitulo(e.target.value)} />
        <span className={`nt-estado ${estado === 'guardado' ? 'nt-estado--ok' : ''} ${estado.startsWith('error') ? 'nt-estado--error' : ''}`} aria-live="polite">{TEXTO_ESTADO[estado] || TEXTO_ESTADO.error}</span>
        <Boton icono="deshacer" nombre="Deshacer (Ctrl+Z)" conservarFoco deshabilitado={!ui?.puedeDeshacer} alPulsar={() => m().deshacer()} />
        <Boton icono="rehacer" nombre="Rehacer (Ctrl+Y)" conservarFoco deshabilitado={!ui?.puedeRehacer} alPulsar={() => m().rehacer()} />
        <Boton icono="exportar" nombre="Exportar nota (.nota)" deshabilitado={exportando} alPulsar={ejecutarExportar} />
        <Boton icono="imprimir" nombre="Imprimir o guardar en PDF" alPulsar={() => setModalImprimir(true)} />
      </header>
      <div className="nt-ed-trabajo">
        <nav className="nt-riel" aria-label="Herramientas">
          <Boton icono="seleccionar" nombre="Seleccionar (Alt+V)" activo={herr === 'seleccionar'} alPulsar={() => m().setHerramienta('seleccionar')} />
          <Boton icono="mano" nombre="Mover el lienzo (Alt+H)" activo={herr === 'mano'} alPulsar={() => m().setHerramienta('mano')} />
          {conMano && <Boton icono="lapiz" nombre="Lápiz (Alt+P)" activo={herr === 'lapiz'} alPulsar={() => m().setHerramienta('lapiz')} />}
          {conMano && <Boton icono="resaltador" nombre="Resaltador (Alt+M)" activo={herr === 'resaltador'} alPulsar={() => m().setHerramienta('resaltador')} />}
          {conMano && <Boton icono="borrador" nombre="Borrador (Alt+B)" activo={herr === 'borrador'} alPulsar={() => m().setHerramienta('borrador')} />}
          {conTeclado && <Boton icono="texto" nombre="Texto por cuadro (Alt+T)" activo={herr === 'texto'} alPulsar={() => m().setHerramienta('texto')} />}
          <InsertarImagen motorRef={motorRef} />
          <MenuFormas herramienta={herr} ultima={ES_FORMA(herr) ? herr : ultimaForma} alElegir={(f) => { setUltimaForma(f); m().setHerramienta(f); }} />
          <hr />
          <Boton icono="frente" nombre="Traer al frente" deshabilitado={!sel} alPulsar={() => m().reordenar('frente')} />
          <Boton icono="subir" nombre="Subir una capa" deshabilitado={!sel} alPulsar={() => m().reordenar('subir')} />
          <Boton icono="bajar" nombre="Bajar una capa" deshabilitado={!sel} alPulsar={() => m().reordenar('bajar')} />
          <Boton icono="fondo" nombre="Enviar al fondo" deshabilitado={!sel} alPulsar={() => m().reordenar('fondo')} />
          <hr />
          <Boton icono="eliminar" nombre="Eliminar (Supr)" deshabilitado={!sel} alPulsar={() => m().eliminarSeleccion()} />
        </nav>
        <div className="nt-lienzo">
          <canvas ref={canvasRef} tabIndex={0} aria-label="Lienzo de dibujo" />
          <div className="nt-capa-texto" ref={capaTextoRef} />
          {ui && ['lapiz', 'resaltador', 'borrador'].includes(herr) && <Propiedades ui={ui} motorRef={motorRef} />}
          {ui && (ES_FORMA(herr) || (herr === 'seleccionar' && ui.figura.seleccionadas > 0)) && <PanelFigura estilo={ui.figura} motorRef={motorRef} />}
          {ui?.imagenSeleccionada && <PanelImagen imagen={ui.imagenSeleccionada} motorRef={motorRef} />}
          {ui && ui.elementos > 0 && ui.fueraDeVista && !ui.texto && <button className="nt-btn nt-volver" onClick={() => m().encuadrarTodo()}>↩ Volver al contenido</button>}
          {ui && ui.elementos > 0 && ui.ajustes.vista.minimapa && <Minimapa motorRef={motorRef} />}
          {ui?.texto && <BarraTexto estado={ui.texto} motorRef={motorRef} />}
          {!ui && !error && <p className="nt-lienzo__aviso">Cargando…</p>}
          {error && <p className="nt-aviso nt-lienzo__aviso" role="alert">{error}</p>}
          <div className="nt-zoom" role="group" aria-label="Zoom">
            <button className="nt-ib" aria-label="Alejar" onClick={() => m().zoomPaso(1 / 1.25)}>−</button>
            <button className="nt-zoom__valor" onClick={() => m().zoomReal()} title="Volver al 100 %">{ui?.zoom ?? 100} %</button>
            <button className="nt-ib" aria-label="Acercar" onClick={() => m().zoomPaso(1.25)}>+</button>
            <button className="nt-btn" onClick={() => m().encuadrarTodo()}>Ver todo</button>
            {ui && <MenuRenglones renglones={ui.renglones} motorRef={motorRef} />}
            <Boton icono="mapa" nombre="Mostrar u ocultar el minimapa" activo={!!ui?.ajustes.vista.minimapa} alPulsar={() => m().configurar('vista', { minimapa: !ui.ajustes.vista.minimapa })} />
          </div>
          {sel && <div className="nt-seleccion">{ui.seleccionados} seleccionado{ui.seleccionados > 1 ? 's' : ''}</div>}
        </div>
      </div>
      {modalImprimir && (
        <Modal titulo="Imprimir o exportar como PDF" alCerrar={() => setModalImprimir(false)} ancho={440}>
          <div className="nt-campos">
            <label className="nt-check">
              <input
                type="checkbox"
                checked={imprimirRenglones}
                onChange={(e) => setImprimirRenglones(e.target.checked)}
              />
              Incluir renglones / cuadrícula al imprimir
            </label>
          </div>
          <div className="nt-acciones">
            <button type="button" className="nt-btn" onClick={() => setModalImprimir(false)}>Cancelar</button>
            <button type="button" className="nt-btn nt-btn--primario" onClick={ejecutarImpresion}>Imprimir / Guardar en PDF</button>
          </div>
        </Modal>
      )}
      <div id="nt-area-impresion-pizarron" className="nt-area-impresion-pizarron" />
    </div>
  );
}
