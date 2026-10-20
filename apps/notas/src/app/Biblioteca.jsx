import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  guardarDocumento, listarDocumentos, borrarDocumentoDefinitivo,
  duplicarDocumento, enviarAPapelera, obtenerAjuste, guardarAjuste,
  estadoAlmacenamiento, pedirPersistencia, asegurarPersistencia,
  listarCarpetas, guardarCarpeta, eliminarCarpeta, moverDocumentoACarpeta,
  asignarEtiquetasDocumento, COLORES_CARPETA,
} from '../almacen/index.js';
import {
  exportarDocumento, exportarTodasLasNotas,
  importarArchivos,
  obtenerConfiguracionCopias, guardarConfiguracionCopias,
  registrarCopiaRealizada, comprobarNecesidadCopia,
  INTERVALOS_COPIA, soportaCarpetaLocal, resolverCarpetaDeCopias, realizarCopiaEnCarpeta,
  obtenerCarpetaGuardada, olvidarCarpetaGuardada,
} from '../archivos/index.js';
import { Modal } from './Modal.jsx';
import ModalInstalar from './ModalInstalar.jsx';
import { Miniatura, SelectorFormato } from './SelectorFormato.jsx';
import { NOMBRE_FORMATO, fechaRelativa, mb, normalizar } from './utiles.js';

function ModalGestionCarpeta({ carpeta, alCerrar, alGuardar }) {
  const [nombre, setNombre] = useState(carpeta?.nombre || '');
  const [color, setColor] = useState(carpeta?.color || COLORES_CARPETA[0][0]);
  return (
    <Modal titulo={carpeta ? 'Editar materia' : 'Nueva materia'} alCerrar={alCerrar} ancho={440}>
      <form onSubmit={(e) => { e.preventDefault(); alGuardar({ id: carpeta?.id, nombre, color }); }}>
        <div style={{ display: 'grid', gap: '14px' }}>
          <label>
            Nombre de la materia o cuaderno
            <input
              className="nt-campo nt-ancho"
              placeholder="Ej. Anatomía I, Fisiología..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
            />
          </label>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--nt-suave)' }}>Color identificativo:</span>
            <div className="nt-selector-color">
              {COLORES_CARPETA.map(([hex, desc]) => (
                <button
                  key={hex}
                  type="button"
                  className={`nt-selector-color__boton ${color === hex ? 'nt-selector-color__boton--sel' : ''}`}
                  style={{ background: hex }}
                  title={desc}
                  aria-label={desc}
                  onClick={() => setColor(hex)}
                />
              ))}
            </div>
          </div>
          <div className="nt-acciones">
            <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
            <button type="submit" className="nt-btn nt-btn--primario">Guardar materia</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ModalConfirmarEliminarCarpeta({ carpeta, alCerrar, alConfirmar }) {
  return (
    <Modal titulo="¿Eliminar esta materia?" alCerrar={alCerrar} ancho={440}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <p style={{ margin: 0 }}>
          Se eliminará la materia <strong>«{carpeta.nombre}»</strong>.
        </p>
        <p className="nt-texto-suave" style={{ margin: 0, fontSize: '13px' }}>
          Sus notas no se borrarán: pasarán a estar en <em>«Sin materia»</em> para que pueda seguir accediendo a ellas.
        </p>
        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
          <button type="button" className="nt-btn nt-btn--peligro" onClick={alConfirmar}>Eliminar materia</button>
        </div>
      </div>
    </Modal>
  );
}

function ModalMoverDocumento({ doc, carpetas, alCerrar, alGuardar }) {
  const [sel, setSel] = useState(doc.carpetaId || '');
  return (
    <Modal titulo="Mover nota a una materia" alCerrar={alCerrar} ancho={440}>
      <form onSubmit={(e) => { e.preventDefault(); alGuardar(doc.id, sel || null); }}>
        <div style={{ display: 'grid', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            Seleccione la materia para <strong>«{doc.titulo}»</strong>:
          </p>
          <label>
            <select className="nt-campo nt-ancho" value={sel} onChange={(e) => setSel(e.target.value)}>
              <option value="">(Sin materia asignada)</option>
              {carpetas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <div className="nt-acciones">
            <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
            <button type="submit" className="nt-btn nt-btn--primario">Guardar</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ModalEditarEtiquetas({ doc, alCerrar, alGuardar }) {
  const [etiquetas, setEtiquetas] = useState(() => (Array.isArray(doc.etiquetas) ? [...doc.etiquetas] : []));
  const [nueva, setNueva] = useState('');

  const agregar = (e) => {
    e.preventDefault();
    const limpia = nueva.trim().replace(/^#+/, '').slice(0, 40);
    if (limpia && !etiquetas.includes(limpia)) {
      setEtiquetas([...etiquetas, limpia]);
      setNueva('');
    }
  };

  const quitar = (tag) => {
    setEtiquetas(etiquetas.filter((t) => t !== tag));
  };

  return (
    <Modal titulo="Etiquetas de la nota" alCerrar={alCerrar} ancho={440}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '13.5px' }}>
          Añada etiquetas para clasificar <strong>«{doc.titulo}»</strong> (por ejemplo: parcial, resumen, tema1):
        </p>
        <form onSubmit={agregar} style={{ display: 'flex', gap: '8px' }}>
          <input
            className="nt-campo"
            style={{ flex: 1 }}
            placeholder="Nueva etiqueta..."
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoFocus
          />
          <button type="submit" className="nt-btn">Añadir</button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px' }}>
          {etiquetas.length === 0 ? (
            <span className="nt-texto-suave" style={{ fontSize: '13px' }}>Sin etiquetas aún.</span>
          ) : (
            etiquetas.map((t) => (
              <span key={t} className="nt-badge-etiqueta" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}>
                #{t}
                <button
                  type="button"
                  aria-label={`Quitar etiqueta ${t}`}
                  style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, marginLeft: '2px', fontWeight: 'bold', color: 'inherit' }}
                  onClick={() => quitar(t)}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
          <button type="button" className="nt-btn nt-btn--primario" onClick={() => alGuardar(doc.id, etiquetas)}>
            Guardar etiquetas
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Renombrar({ doc, alCerrar, alGuardar }) {
  const [titulo, setTitulo] = useState(doc.titulo);
  return (
    <Modal titulo="Renombrar" alCerrar={alCerrar} ancho={440}>
      <form onSubmit={(e) => { e.preventDefault(); alGuardar(doc, titulo.trim() || 'Sin título'); }}>
        <input className="nt-campo nt-ancho" aria-label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} onFocus={(e) => e.target.select()} autoFocus />
        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="nt-btn nt-btn--primario">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalDuplicado({ consulta, alResolver }) {
  const [aplicarATodos, setAplicarATodos] = useState(false);
  const { docExistente, docNuevo, nombreArchivo, totalPendientes } = consulta;

  return (
    <Modal titulo="Documento ya existente" alCerrar={() => alResolver({ decision: 'omitir', aplicarATodos: false })} ancho={480}>
      <div style={{ display: 'grid', gap: '14px' }}>
        <p style={{ margin: 0 }}>
          El documento <strong>«{docNuevo.titulo}»</strong> (proveniente de <em>{nombreArchivo}</em>) ya existe en su biblioteca.
        </p>
        <div style={{ background: 'var(--nt-azul-claro)', padding: '12px', borderRadius: '10px', fontSize: '13px' }}>
          <div><strong>Existente:</strong> {docExistente.titulo} (modificado {fechaRelativa(docExistente.modificado)})</div>
          <div><strong>A importar:</strong> {docNuevo.titulo} (modificado {fechaRelativa(docNuevo.modificado)})</div>
        </div>

        {totalPendientes > 1 && (
          <label className="nt-check">
            <input type="checkbox" checked={aplicarATodos} onChange={(e) => setAplicarATodos(e.target.checked)} />
            Aplicar esta decisión a los siguientes documentos duplicados
          </label>
        )}

        <div className="nt-acciones" style={{ marginTop: '8px' }}>
          <button type="button" className="nt-btn" onClick={() => alResolver({ decision: 'omitir', aplicarATodos })}>
            Omitir
          </button>
          <button type="button" className="nt-btn" onClick={() => alResolver({ decision: 'conservar-ambos', aplicarATodos })}>
            Conservar ambos
          </button>
          <button type="button" className="nt-btn nt-btn--primario" onClick={() => alResolver({ decision: 'reemplazar', aplicarATodos })}>
            Reemplazar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalCopias({ alCerrar, almac, alActualizar }) {
  const [intervalo, setIntervalo] = useState(14);
  const [ultimaFecha, setUltimaFecha] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [nombreCarpeta, setNombreCarpeta] = useState('');

  useEffect(() => {
    (async () => {
      const guardada = await obtenerCarpetaGuardada();
      setNombreCarpeta(guardada?.name || '');
      const cfg = await obtenerConfiguracionCopias();
      setIntervalo(cfg.intervalo);
      setUltimaFecha(cfg.ultimaFecha);
    })();
  }, []);

  const cambiarIntervalo = async (e) => {
    const nuevo = Number(e.target.value);
    setIntervalo(nuevo);
    await guardarConfiguracionCopias({ intervalo: nuevo });
  };

  const ejecutarDescargaCompleta = async () => {
    setGuardando(true);
    setMensaje('');
    setError('');
    try {
      const res = await exportarTodasLasNotas({ compartir: true });
      if (res.metodo === 'cancelado') {
        setMensaje('Copia cancelada: no se guardó ningún archivo.');
      } else {
        await registrarCopiaRealizada();
        setUltimaFecha(Date.now());
        setMensaje(`Copia de seguridad completada con éxito (${res.cantidad} notas incluidas).`);
        alActualizar?.();
      }
    } catch (err) {
      setError('Error al generar la copia de seguridad: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarCopiaEnCarpeta = async ({ elegirOtra = false } = {}) => {
    setGuardando(true);
    setMensaje('');
    setError('');
    try {
      const handle = await resolverCarpetaDeCopias({ elegirOtra });
      setNombreCarpeta(handle.name || '');
      const res = await realizarCopiaEnCarpeta(handle);
      setUltimaFecha(Date.now());
      setMensaje(`Copia guardada directamente en la carpeta local seleccionada («${res.nombreArchivo}», ${res.cantidad} notas).`);
      alActualizar?.();
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Error al guardar en la carpeta local: ' + err.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  const porcentaje = almac?.cuota > 0 ? Math.round((almac.usado / almac.cuota) * 100) : 0;
  const alertaEspacio = porcentaje >= 80;

  return (
    <Modal titulo="Copias de seguridad y almacenamiento" alCerrar={alCerrar} ancho={560}>
      <div style={{ display: 'grid', gap: '16px' }}>
        <p className="nt-texto-suave" style={{ margin: 0 }}>
          Sus notas viven exclusivamente en este dispositivo (en la memoria interna de su navegador). No se suben a ningún servidor ni cuenta externa. Para utilizarlas en otro dispositivo o resguardarlas, expórtelas como archivos .nota o descargue una copia periódica.
        </p>

        <div className="nt-medidor">
          <strong>Almacenamiento del dispositivo</strong>
          <div className="nt-medidor__barra">
            <div
              className={`nt-medidor__relleno ${alertaEspacio ? 'nt-medidor__relleno--alerta' : ''}`}
              style={{ width: `${Math.min(100, Math.max(1, porcentaje))}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--nt-suave)' }}>
            <span>{almac ? `Espacio usado: ${mb(almac.usado)} de ${mb(almac.cuota)} (${porcentaje} %)` : 'Calculando...'}</span>
            <span>{almac?.persistente ? 'Protección persistente activa ✓' : ''}</span>
          </div>
          {alertaEspacio && (
            <div className="nt-alerta--peligro">
              Atención: El almacenamiento del dispositivo supera el 80 %. Realice una copia de seguridad y libere espacio eliminando notas innecesarias para evitar la pérdida de datos.
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--nt-linea)', paddingTop: '14px', display: 'grid', gap: '10px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
            Frecuencia de recordatorio de copia de seguridad:
            <select className="nt-campo" value={intervalo} onChange={cambiarIntervalo}>
              {INTERVALOS_COPIA.map((opt) => (
                <option key={opt.dias} value={opt.dias}>{opt.etiqueta}</option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: '13px', color: 'var(--nt-suave)' }}>
            Última copia realizada: {ultimaFecha > 0 ? fechaRelativa(ultimaFecha) : 'Ninguna registrada'}
          </span>
        </div>

        <div style={{ borderTop: '1px solid var(--nt-linea)', paddingTop: '14px', display: 'grid', gap: '10px' }}>
          <strong>Acciones de respaldo</strong>
          <button
            type="button"
            className="nt-btn nt-btn--primario"
            disabled={guardando}
            onClick={ejecutarDescargaCompleta}
          >
            {guardando ? 'Generando copia…' : 'Descargar copia completa (.anotomia-respaldo)'}
          </button>

          {soportaCarpetaLocal() ? (
            <>
              <button
                type="button"
                className="nt-btn"
                disabled={guardando}
                onClick={() => ejecutarCopiaEnCarpeta()}
              >
                {nombreCarpeta ? `Guardar copia en «${nombreCarpeta}»` : 'Guardar copia en carpeta local…'}
              </button>
              {nombreCarpeta && (
                <span className="nt-texto-suave" style={{ fontSize: '12px' }}>
                  Se recuerda esta carpeta; el navegador puede pedirle permiso de nuevo al abrir la app.{' '}
                  <button type="button" className="nt-enlace" disabled={guardando} onClick={() => ejecutarCopiaEnCarpeta({ elegirOtra: true })}>Elegir otra carpeta</button>
                  {' · '}
                  <button type="button" className="nt-enlace" disabled={guardando} onClick={async () => { await olvidarCarpetaGuardada(); setNombreCarpeta(''); }}>Olvidar</button>
                </span>
              )}
            </>
          ) : (
            <span className="nt-texto-suave" style={{ fontSize: '12px' }}>
              Su navegador no admite la selección directa de carpetas locales (File System Access API). Descargue su copia de respaldo manualmente con el botón superior.
            </span>
          )}
        </div>

        {mensaje && <p className="nt-aviso nt-aviso--ok" style={{ margin: 0 }}>{mensaje}</p>}
        {error && <p className="nt-aviso" role="alert" style={{ margin: 0 }}>{error}</p>}

        <div className="nt-acciones">
          <button type="button" className="nt-btn" onClick={alCerrar}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

function Elemento({ doc, abrir, menuAbierto, setMenu, accion, carpetasMap }) {
  if (doc._danado) {
    return (
      <li className="nt-item nt-item--danado" style={{ border: '1px dashed #ef4444', background: '#fef2f2' }}>
        <div className="nt-item__abrir" style={{ opacity: 0.85, cursor: 'default' }}>
          <span style={{ fontSize: '24px', marginRight: '8px' }}>⚠️</span>
          <span className="nt-item__datos">
            <strong style={{ color: '#b91c1c' }}>{doc.titulo}</strong>
            <span style={{ color: '#dc2626' }}>Archivo dañado · {fechaRelativa(doc.modificado)}</span>
          </span>
        </div>
        <button className="nt-item__menu" aria-label={`Opciones del documento dañado ${doc.titulo}`} aria-haspopup="menu" aria-expanded={menuAbierto}
          onClick={(e) => { e.stopPropagation(); setMenu(menuAbierto ? null : doc.id); }}>⋯</button>
        {menuAbierto && (
          <div className="nt-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <button role="menuitem" onClick={() => accion('exportar', doc)}>Exportar datos crudos</button>
            <button role="menuitem" onClick={() => accion('borrar-directo', doc)}>Eliminar registro dañado</button>
          </div>
        )}
      </li>
    );
  }

  const carpeta = doc.carpetaId && carpetasMap ? carpetasMap.get(doc.carpetaId) : null;
  const tieneEtiquetas = Array.isArray(doc.etiquetas) && doc.etiquetas.length > 0;

  return (
    <li className="nt-item">
      <button className="nt-item__abrir" onClick={() => abrir(doc)}>
        <Miniatura formato={doc.formato} />
        <span className="nt-item__datos">
          <strong>{doc.titulo}</strong>
          <span>{NOMBRE_FORMATO[doc.formato]} · {fechaRelativa(doc.modificado)}</span>
          {carpeta && (
            <span
              className="nt-badge-carpeta"
              style={{ background: `${carpeta.color}15`, color: carpeta.color, border: `1px solid ${carpeta.color}35` }}
            >
              <span className="nt-badge-carpeta__punto" style={{ background: carpeta.color }} />
              <span className="nt-badge-carpeta__texto">{carpeta.nombre}</span>
            </span>
          )}
          {tieneEtiquetas && (
            <div className="nt-etiquetas-lista">
              {doc.etiquetas.map((t) => (
                <span key={t} className="nt-badge-etiqueta">#{t}</span>
              ))}
            </div>
          )}
        </span>
      </button>
      <button className="nt-item__menu" aria-label={`Opciones de ${doc.titulo}`} aria-haspopup="menu" aria-expanded={menuAbierto}
        onClick={(e) => { e.stopPropagation(); setMenu(menuAbierto ? null : doc.id); }}>⋯</button>
      {menuAbierto && (
        <div className="nt-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          <button role="menuitem" onClick={() => accion('renombrar', doc)}>Renombrar</button>
          <button role="menuitem" onClick={() => accion('mover', doc)}>Mover a materia...</button>
          <button role="menuitem" onClick={() => accion('etiquetas', doc)}>Etiquetas...</button>
          <button role="menuitem" onClick={() => accion('duplicar', doc)}>Duplicar</button>
          <button role="menuitem" onClick={() => accion('exportar', doc)}>Exportar (.nota)</button>
          <button role="menuitem" onClick={() => accion('papelera', doc)}>Enviar a la papelera</button>
        </div>
      )}
    </li>
  );
}

export default function Biblioteca({ abrirDocumento, irAPapelera, cantidadPapelera, avisarCambio, abrirAyuda }) {
  const [docs, setDocs] = useState(null);
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaActiva, setCarpetaActiva] = useState('todas');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('fecha');
  const [vista, setVista] = useState('cuadricula');
  const [nuevo, setNuevo] = useState(false);
  const [renombrando, setRenombrando] = useState(null);
  const [modalCarpeta, setModalCarpeta] = useState(null);
  const [eliminarCarpetaObj, setEliminarCarpetaObj] = useState(null);
  const [moverDoc, setMoverDoc] = useState(null);
  const [etiquetasDoc, setEtiquetasDoc] = useState(null);
  const [menu, setMenu] = useState(null);
  const [almac, setAlmac] = useState(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  // Estados de Etapa 12: Importación, arrastre y copias
  const [modalCopias, setModalCopias] = useState(false);
  const [modalInstalar, setModalInstalar] = useState(false);
  const [consultaDuplicado, setConsultaDuplicado] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [recordatorioVisible, setRecordatorioVisible] = useState(false);
  const [diasRecordatorio, setDiasRecordatorio] = useState(14);
  const inputArchivoRef = useRef(null);

  const verificarRecordatorio = useCallback(async (listaDocs) => {
    try {
      const cfg = await obtenerConfiguracionCopias();
      setDiasRecordatorio(cfg.intervalo);
      const necesario = comprobarNecesidadCopia(listaDocs, cfg);
      setRecordatorioVisible(necesario);
    } catch {
      /* ignorar fallos de lectura de ajustes */
    }
  }, []);

  const recargar = useCallback(async () => {
    try {
      const [lista, listaCarpetas] = await Promise.all([
        listarDocumentos(),
        listarCarpetas(),
      ]);
      setDocs(lista);
      setCarpetas(listaCarpetas);
      await asegurarPersistencia({ hayNotas: lista.length > 0 });
      const est = await estadoAlmacenamiento();
      setAlmac(est);
      verificarRecordatorio(lista);
      avisarCambio();
    } catch (e) { setError(e.message); setDocs([]); }
  }, [avisarCambio, verificarRecordatorio]);

  useEffect(() => {
    (async () => {
      setOrden(await obtenerAjuste('biblioteca.orden', 'fecha'));
      setVista(await obtenerAjuste('biblioteca.vista', 'cuadricula'));
      recargar();
    })();
  }, [recargar]);

  useEffect(() => {
    if (!menu) return undefined;
    const cerrar = () => setMenu(null);
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('click', cerrar);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('click', cerrar); document.removeEventListener('keydown', tecla); };
  }, [menu]);

  const carpetasMap = useMemo(() => {
    const map = new Map();
    carpetas.forEach((c) => map.set(c.id, c));
    return map;
  }, [carpetas]);

  const conteosCarpetas = useMemo(() => {
    if (!docs) return { todas: 0, sinCarpeta: 0, porId: {} };
    const porId = {};
    let sinCarpeta = 0;
    docs.forEach((d) => {
      if (d._danado) return;
      if (!d.carpetaId || !carpetasMap.has(d.carpetaId)) {
        sinCarpeta++;
      } else {
        porId[d.carpetaId] = (porId[d.carpetaId] || 0) + 1;
      }
    });
    return { todas: docs.filter((d) => !d._danado).length, sinCarpeta, porId };
  }, [docs, carpetasMap]);

  const todasEtiquetas = useMemo(() => {
    if (!docs) return [];
    const set = new Set();
    docs.forEach((d) => {
      if (Array.isArray(d.etiquetas)) {
        d.etiquetas.forEach((t) => set.add(t));
      }
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [docs]);

  const mostrados = useMemo(() => {
    if (!docs) return [];
    let lista = [...docs];

    // Filtrar por carpeta/materia
    if (carpetaActiva === 'sin-carpeta') {
      lista = lista.filter((d) => !d.carpetaId || !carpetasMap.has(d.carpetaId));
    } else if (carpetaActiva !== 'todas') {
      lista = lista.filter((d) => d.carpetaId === carpetaActiva);
    }

    // Filtrar por etiqueta
    if (etiquetaFiltro) {
      lista = lista.filter((d) => Array.isArray(d.etiquetas) && d.etiquetas.includes(etiquetaFiltro));
    }

    // Filtrar por búsqueda de texto
    const q = normalizar(busqueda);
    if (q) {
      lista = lista.filter((d) => {
        const enTitulo = normalizar(d.titulo).includes(q);
        const enTags = Array.isArray(d.etiquetas) && d.etiquetas.some((t) => normalizar(t).includes(q));
        const c = d.carpetaId ? carpetasMap.get(d.carpetaId) : null;
        const enCarpeta = c && normalizar(c.nombre).includes(q);
        return enTitulo || enTags || enCarpeta;
      });
    }

    if (orden === 'nombre') lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }));
    else lista.sort((a, b) => b.modificado - a.modificado);
    return lista;
  }, [docs, carpetaActiva, carpetasMap, etiquetaFiltro, busqueda, orden]);

  const cambiarOrden = (v) => { setOrden(v); guardarAjuste('biblioteca.orden', v); };
  const cambiarVista = (v) => { setVista(v); guardarAjuste('biblioteca.vista', v); };

  async function accion(tipo, doc) {
    setMenu(null);
    try {
      if (tipo === 'renombrar') setRenombrando(doc);
      if (tipo === 'mover') setMoverDoc(doc);
      if (tipo === 'etiquetas') setEtiquetasDoc(doc);
      if (tipo === 'duplicar') { await duplicarDocumento(doc.id); setAviso('Documento duplicado.'); await recargar(); }
      if (tipo === 'exportar') {
        const res = await exportarDocumento(doc, { compartir: true });
        setAviso(res.metodo === 'cancelado' ? 'Exportación cancelada: no se guardó ningún archivo.' : `«${doc.titulo}» exportado como ${res.nombreArchivo}.`);
      }
      if (tipo === 'papelera') { await enviarAPapelera(doc); setAviso(`«${doc.titulo}» está en la papelera.`); await recargar(); }
      if (tipo === 'borrar-directo') { await borrarDocumentoDefinitivo(doc.id); setAviso('Registro eliminado.'); await recargar(); }
    } catch (e) { setError(e.message); }
  }

  async function guardarTitulo(doc, titulo) {
    setRenombrando(null);
    try { await guardarDocumento({ ...doc, titulo }); await recargar(); } catch (e) { setError(e.message); }
  }

  async function guardarCarpetaAccion({ id, nombre, color }) {
    setModalCarpeta(null);
    try {
      const c = await guardarCarpeta({ id, nombre, color });
      setAviso(`Materia «${c.nombre}» guardada.`);
      await recargar();
      if (!id) setCarpetaActiva(c.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarEliminarCarpetaAccion() {
    if (!eliminarCarpetaObj) return;
    const { id, nombre } = eliminarCarpetaObj;
    setEliminarCarpetaObj(null);
    try {
      await eliminarCarpeta(id);
      setAviso(`Materia «${nombre}» eliminada. Las notas se conservaron en «Sin materia».`);
      if (carpetaActiva === id) setCarpetaActiva('todas');
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarMoverDocumento(docId, carpetaId) {
    setMoverDoc(null);
    try {
      await moverDocumentoACarpeta(docId, carpetaId);
      setAviso('Nota reubicada con éxito.');
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarEtiquetasDocumento(docId, tags) {
    setEtiquetasDoc(null);
    try {
      await asignarEtiquetasDocumento(docId, tags);
      setAviso('Etiquetas actualizadas.');
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function procesarImportacion(archivos) {
    if (!archivos || archivos.length === 0) return;
    setError('');
    setAviso('');

    try {
      const res = await importarArchivos(archivos, {
        solicitarDecision: (datosConsulta) => new Promise((resolver) => {
          setConsultaDuplicado({ ...datosConsulta, resolver });
        }),
      });

      let texto = `Se importaron ${res.importados} nota${res.importados === 1 ? '' : 's'}`;
      if (res.reemplazados > 0 || res.conservados > 0 || res.omitidos > 0) {
        const detalles = [];
        if (res.reemplazados > 0) detalles.push(`${res.reemplazados} reemplazada${res.reemplazados === 1 ? '' : 's'}`);
        if (res.conservados > 0) detalles.push(`${res.conservados} conservada${res.conservados === 1 ? '' : 's'} como copia`);
        if (res.omitidos > 0) detalles.push(`${res.omitidos} omitida${res.omitidos === 1 ? '' : 's'}`);
        texto += ` (${detalles.join(', ')}).`;
      } else {
        texto += '.';
      }

      if (res.imagenesOmitidas > 0) {
        texto += ` Atención: ${res.imagenesOmitidas} imagen${res.imagenesOmitidas === 1 ? '' : 'es'} no venía${res.imagenesOmitidas === 1 ? '' : 'n'} en el archivo y se omitió${res.imagenesOmitidas === 1 ? '' : 'ieron'}.`;
      }

      if (res.errores.length > 0) {
        setError(`Errores al importar: ${res.errores.map((e) => `${e.archivo}: ${e.mensaje}`).join(' | ')}`);
      }
      if (res.importados > 0) {
        setAviso(texto);
        await recargar();
      }
    } catch (err) {
      setError('Error general al importar: ' + err.message);
    }
  }

  function resolverDuplicado({ decision, aplicarATodos }) {
    if (consultaDuplicado?.resolver) {
      consultaDuplicado.resolver({ decision, aplicarATodos });
    }
    setConsultaDuplicado(null);
  }

  const alDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!arrastrando) setArrastrando(true);
  };

  const alDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setArrastrando(false);
  };

  const alDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrando(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      procesarImportacion(e.dataTransfer.files);
    }
  };

  return (
    <div className="nt-pantalla">
      <header className="nt-cabecera">
        <div className="nt-logo">Anotomía</div>
        <button className="nt-btn" onClick={irAPapelera}>Papelera{cantidadPapelera > 0 ? ` (${cantidadPapelera})` : ''}</button>
        <button className="nt-btn" onClick={() => inputArchivoRef.current?.click()} title="Importar archivos .nota o respaldos">Importar</button>
        <button className="nt-btn" onClick={() => setModalCopias(true)} title="Copias de seguridad y almacenamiento">Copias de seguridad</button>
        {abrirAyuda && <button className="nt-btn" onClick={abrirAyuda} title="Ayuda de atajos y gestos" aria-label="Ayuda">Ayuda (?)</button>}
        <button className="nt-btn nt-btn--primario" onClick={() => setNuevo(true)}>Nueva nota</button>
        <input
          ref={inputArchivoRef}
          type="file"
          accept=".nota,.anotomia-respaldo,application/x-anotomia-nota,application/json"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              procesarImportacion(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </header>
      <main
        className={`nt-biblioteca ${arrastrando ? 'nt-biblioteca--arrastre' : ''}`}
        onDragOver={alDragOver}
        onDragLeave={alDragLeave}
        onDrop={alDrop}
      >
        {recordatorioVisible && (
          <div className="nt-banner-copia" role="alert">
            <span>
              Han pasado más de {diasRecordatorio} días desde su última copia de seguridad y tiene notas modificadas.
            </span>
            <div className="nt-banner-copia__acciones">
              <button type="button" className="nt-btn nt-btn--primario nt-btn--sm" onClick={() => setModalCopias(true)}>
                Hacer copia ahora
              </button>
              <button type="button" className="nt-btn nt-btn--sm" onClick={() => setRecordatorioVisible(false)}>
                Recordar más tarde
              </button>
            </div>
          </div>
        )}

        <h1 className="nt-titulo">Mis notas</h1>

        {/* Barra de materias / carpetas */}
        <div className="nt-carpetas-contenedor">
          <div className="nt-carpetas-barra" role="tablist" aria-label="Materias y carpetas">
            <button
              type="button"
              role="tab"
              aria-selected={carpetaActiva === 'todas'}
              className={`nt-pestana-carpeta ${carpetaActiva === 'todas' ? 'nt-pestana-carpeta--activa' : ''}`}
              onClick={() => setCarpetaActiva('todas')}
            >
              Todas
              <span className="nt-pestana-carpeta__contador">({conteosCarpetas.todas})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={carpetaActiva === 'sin-carpeta'}
              className={`nt-pestana-carpeta ${carpetaActiva === 'sin-carpeta' ? 'nt-pestana-carpeta--activa' : ''}`}
              onClick={() => setCarpetaActiva('sin-carpeta')}
            >
              Sin materia
              <span className="nt-pestana-carpeta__contador">({conteosCarpetas.sinCarpeta})</span>
            </button>
            {carpetas.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={carpetaActiva === c.id}
                className={`nt-pestana-carpeta ${carpetaActiva === c.id ? 'nt-pestana-carpeta--activa' : ''}`}
                onClick={() => setCarpetaActiva(c.id)}
              >
                <span className="nt-pestana-carpeta__punto" style={{ background: c.color }} />
                <span>{c.nombre}</span>
                <span className="nt-pestana-carpeta__contador">({conteosCarpetas.porId[c.id] || 0})</span>
              </button>
            ))}
            <button
              type="button"
              className="nt-btn nt-btn--sm"
              onClick={() => setModalCarpeta({ modo: 'crear' })}
              title="Crear nueva materia o cuaderno"
              aria-label="Nueva materia"
            >
              + Materia
            </button>
          </div>

          {/* Opciones de la materia actualmente activa */}
          {carpetaActiva !== 'todas' && carpetaActiva !== 'sin-carpeta' && carpetasMap.has(carpetaActiva) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--nt-suave)' }}>
                Materia activa: <strong style={{ color: carpetasMap.get(carpetaActiva).color }}>{carpetasMap.get(carpetaActiva).nombre}</strong>
              </span>
              <button
                type="button"
                className="nt-enlace"
                style={{ fontSize: '12px' }}
                onClick={() => setModalCarpeta({ modo: 'editar', carpeta: carpetasMap.get(carpetaActiva) })}
              >
                Editar
              </button>
              <button
                type="button"
                className="nt-enlace"
                style={{ fontSize: '12px', color: 'var(--nt-error)' }}
                onClick={() => setEliminarCarpetaObj(carpetasMap.get(carpetaActiva))}
              >
                Eliminar
              </button>
            </div>
          )}

          {/* Barra de etiquetas para filtrado */}
          {todasEtiquetas.length > 0 && (
            <div className="nt-etiquetas-barra" aria-label="Filtrar por etiqueta">
              <span style={{ fontSize: '12px', color: 'var(--nt-suave)' }}>Etiquetas:</span>
              {todasEtiquetas.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`nt-chip-filtro-etiqueta ${etiquetaFiltro === tag ? 'nt-chip-filtro-etiqueta--activa' : ''}`}
                  onClick={() => setEtiquetaFiltro(etiquetaFiltro === tag ? null : tag)}
                  aria-pressed={etiquetaFiltro === tag}
                >
                  #{tag}
                </button>
              ))}
              {etiquetaFiltro && (
                <button
                  type="button"
                  className="nt-enlace"
                  style={{ fontSize: '12px' }}
                  onClick={() => setEtiquetaFiltro(null)}
                >
                  (Quitar filtro)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="nt-barra">
          <input type="search" className="nt-campo nt-barra__buscar" placeholder="Buscar por título, materia o etiqueta" aria-label="Buscar notas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <select className="nt-campo" aria-label="Ordenar" value={orden} onChange={(e) => cambiarOrden(e.target.value)}>
            <option value="fecha">Más recientes</option><option value="nombre">Nombre (A–Z)</option>
          </select>
          <select className="nt-campo" aria-label="Vista" value={vista} onChange={(e) => cambiarVista(e.target.value)}>
            <option value="cuadricula">Cuadrícula</option><option value="lista">Lista</option>
          </select>
        </div>
        {error && <p className="nt-aviso" role="alert">{error}</p>}
        {aviso && <p className="nt-aviso nt-aviso--ok" role="status">{aviso}</p>}
        {docs === null ? <p className="nt-texto-suave">Cargando…</p>
          : docs.length === 0 ? (
            <div className="nt-vacio"><p className="nt-sub">Todavía no hay notas</p><p className="nt-texto-suave">Cree la primera para comenzar o arrastre archivos .nota aquí.</p>
              <button className="nt-btn nt-btn--primario" onClick={() => setNuevo(true)}>Nueva nota</button></div>
          ) : mostrados.length === 0 ? <p className="nt-texto-suave">Ninguna nota coincide con los filtros aplicados.</p>
          : (
            <ul className={`nt-items nt-items--${vista}`}>
              {mostrados.map((d) => (
                <Elemento
                  key={d.id}
                  doc={d}
                  abrir={abrirDocumento}
                  menuAbierto={menu === d.id}
                  setMenu={setMenu}
                  accion={accion}
                  carpetasMap={carpetasMap}
                />
              ))}
            </ul>
          )}
      </main>
      <footer className="nt-pie">
        <span>
          Sus notas se guardan en este dispositivo. Para pasarlas a otro, exporte un archivo .nota.
          <button className="nt-enlace" onClick={() => setModalCopias(true)}>Copias y espacio</button>
          <button className="nt-enlace" onClick={() => setModalInstalar(true)}>Instalar la app</button>
        </span>
        <span>
          {almac?.disponible ? `Espacio usado: ${mb(almac.usado)}` : ''}
          {almac?.disponible && !almac.persistente && <button className="nt-enlace" onClick={async () => { await pedirPersistencia(); setAlmac(await estadoAlmacenamiento()); }}>Proteger datos</button>}
        </span>
      </footer>
      {nuevo && <SelectorFormato alCerrar={() => setNuevo(false)} alCrear={(doc) => { setNuevo(false); abrirDocumento(doc); }} />}
      {renombrando && <Renombrar doc={renombrando} alCerrar={() => setRenombrando(null)} alGuardar={guardarTitulo} />}
      {modalCarpeta && (
        <ModalGestionCarpeta
          carpeta={modalCarpeta.carpeta}
          alCerrar={() => setModalCarpeta(null)}
          alGuardar={guardarCarpetaAccion}
        />
      )}
      {eliminarCarpetaObj && (
        <ModalConfirmarEliminarCarpeta
          carpeta={eliminarCarpetaObj}
          alCerrar={() => setEliminarCarpetaObj(null)}
          alConfirmar={confirmarEliminarCarpetaAccion}
        />
      )}
      {moverDoc && (
        <ModalMoverDocumento
          doc={moverDoc}
          carpetas={carpetas}
          alCerrar={() => setMoverDoc(null)}
          alGuardar={guardarMoverDocumento}
        />
      )}
      {etiquetasDoc && (
        <ModalEditarEtiquetas
          doc={etiquetasDoc}
          alCerrar={() => setEtiquetasDoc(null)}
          alGuardar={guardarEtiquetasDocumento}
        />
      )}
      {modalCopias && (
        <ModalCopias
          alCerrar={() => setModalCopias(false)}
          almac={almac}
          alActualizar={recargar}
        />
      )}
      {modalInstalar && <ModalInstalar alCerrar={() => setModalInstalar(false)} />}
      {consultaDuplicado && (
        <ModalDuplicado
          consulta={consultaDuplicado}
          alResolver={resolverDuplicado}
        />
      )}
    </div>
  );
}
