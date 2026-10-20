// Editor de Tarjetas (Etapa 9): fichas de estudio para una idea por tarjeta.
// Cada tarjeta es una ficha física independiente, con navegación, duplicado,
// ordenación, selección de tamaño y soporte de impresión con/sin renglones.
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  borrarElementos, crearAutoguardado, guardarAjuste, guardarDocumento, guardarElementos, guardarPendientesDeEscena, listarElementos, nuevoId, obtenerAjuste,
} from '../almacen/index.js';
import { Escena } from '../lienzo/escena.js';
import { Lienzo } from '../lienzo/motor.js';
import { encuadrar } from '../lienzo/camara.js';
import { dibujar } from '../lienzo/dibujo.js';
import BarraTexto from '../app/BarraTexto.jsx';
import MenuRenglones from '../app/MenuRenglones.jsx';
import MenuFormas from '../app/MenuFormas.jsx';
import { ES_FORMA } from '../app/formas.js';
import PanelFigura from '../app/PanelFigura.jsx';
import PanelImagen from '../app/PanelImagen.jsx';
import InsertarImagen from '../app/InsertarImagen.jsx';
import { Modal } from '../app/Modal.jsx';
import {
  Boton, Propiedades, TEXTO_ESTADO,
} from '../app/EditorComun.jsx';
import {
  asignarHuerfanos, duplicarElementosTarjeta, elementosDeTarjeta, medidasTarjeta, moverTarjeta, normalizarPersonalizado, normalizarTarjetasConfig,
} from './tarjetas.js';
import { aplicarOperacion, crearHistorialTarjetas, crearOperacion } from './historialTarjetas.js';
import EstudioTarjetas from './EstudioTarjetas.jsx';
import { construirHojasTarjetas, factorResolucion, imprimirContenedor } from './impresion.js';
import { exportarDocumento } from '../archivos/exportar.js';
import { prepararImagenes } from '../herramientas/imagenes/recursos.js';
import TiraTarjetas, { CuadriculaTarjetas } from './TiraTarjetas.jsx';

export default function EditorTarjetas({ doc, volver }) {
  const canvasRef = useRef(null);
  const capaTextoRef = useRef(null);
  const motorRef = useRef(null);
  const autoRef = useRef(null);
  const docRef = useRef({ ...doc });
  const tituloSucio = useRef(false);
  const histTarjetasRef = useRef(crearHistorialTarjetas()); // operaciones sobre la lista de tarjetas
  const bajaEscenaInicialRef = useRef(() => {});
  const marcaMiniaturaRef = useRef('');
  const ocupadoRef = useRef(false);
  const aplicarOpRef = useRef(null);

  // Normalización de la configuración de tarjetas
  const [cfg, setCfg] = useState(() => normalizarTarjetasConfig(doc.config));
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const [titulo, setTitulo] = useState(doc.titulo);
  const [ui, setUi] = useState(null);
  const [estado, setEstado] = useState('sin-cambios');
  const [error, setError] = useState('');
  const [ultimaForma, setUltimaForma] = useState('rectangulo');

  // Control de tira lateral, cuadrícula y número de revisión para miniaturas
  const [mostrarTira, setMostrarTira] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 900 : true));
  const [mostrarCuadricula, setMostrarCuadricula] = useState(false);
  const [mostrarEstudio, setMostrarEstudio] = useState(false);
  // Revisión de contenido por tarjeta: solo se redibuja la miniatura de la tarjeta que cambió
  const [revs, setRevs] = useState({});
  const marcarRev = useCallback((...ids) => {
    setRevs((r) => {
      const n = { ...r };
      ids.forEach((id) => { if (id) n[id] = (n[id] || 0) + 1; });
      return n;
    });
  }, []);

  // Al completarse un guardado, se actualiza la miniatura de la tarjeta activa (si su contenido cambió)
  useEffect(() => {
    if (estado !== 'guardado') return;
    const escena = motorRef.current?.escena;
    if (!escena) return;
    const marca = `${cfgRef.current.tarjetaActiva}:${escena.version}`;
    if (marca === marcaMiniaturaRef.current) return;
    marcaMiniaturaRef.current = marca;
    marcarRev(cfgRef.current.tarjetaActiva);
  }, [estado, marcarRev]);

  // Al mostrar u ocultar la tira lateral, notificar redimensionamiento inmediato
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      motorRef.current?.redimensionarCanvas();
    });
    return () => cancelAnimationFrame(id);
  }, [mostrarTira]);

  // Menú de tamaño de tarjeta
  const [menuTamanoAbierto, setMenuTamanoAbierto] = useState(false);
  const [posTamano, setPosTamano] = useState(null);
  const botonTamanoRef = useRef(null);
  const panelTamanoRef = useRef(null);
  const [anchoMmPers, setAnchoMmPers] = useState(cfg.personalizado?.anchoMm ?? 150);
  const [altoMmPers, setAltoMmPers] = useState(cfg.personalizado?.altoMm ?? 100);

  useEffect(() => {
    if (cfg.personalizado?.anchoMm) setAnchoMmPers(cfg.personalizado.anchoMm);
    if (cfg.personalizado?.altoMm) setAltoMmPers(cfg.personalizado.altoMm);
  }, [cfg.personalizado]);

  useEffect(() => {
    if (!menuTamanoAbierto) return undefined;
    const fuera = (e) => {
      if (!panelTamanoRef.current?.contains(e.target) && !botonTamanoRef.current?.contains(e.target)) {
        setMenuTamanoAbierto(false);
      }
    };
    const tecla = (e) => { if (e.key === 'Escape') setMenuTamanoAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [menuTamanoAbierto]);

  function abrirMenuTamano() {
    if (menuTamanoAbierto) {
      setMenuTamanoAbierto(false);
      return;
    }
    const b = botonTamanoRef.current?.getBoundingClientRect();
    if (b) {
      setPosTamano({
        left: Math.max(8, Math.min(b.left, window.innerWidth - 308)),
        top: b.bottom + 6,
      });
    }
    setMenuTamanoAbierto(true);
  }

  // Todos los elementos del documento cargados en memoria
  const todosElementosRef = useRef([]);
  const [cargado, setCargado] = useState(false);

  // Modal de impresión
  const [modalImprimir, setModalImprimir] = useState(false);
  const [modoImpresion, setModoImpresion] = useState('todas'); // todas | actual
  const [imprimirRenglones, setImprimirRenglones] = useState(cfg.imprimirRenglones);
  const [porHoja, setPorHoja] = useState(cfg.porHoja || 1);
  const [marcasDeCorte, setMarcasDeCorte] = useState(!!cfg.marcasDeCorte);

  // Modal para confirmar eliminación de tarjeta
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  // Se memoriza para que las miniaturas no se redibujen en cada renderizado
  const medidas = useMemo(
    () => medidasTarjeta(cfg.tamano, cfg.personalizado),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.tamano, cfg.personalizado?.anchoMm, cfg.personalizado?.altoMm],
  );
  const tarjetaActual = cfg.tarjetas.find((t) => t.id === cfg.tarjetaActiva) || cfg.tarjetas[0];
  const indiceActual = cfg.tarjetas.findIndex((t) => t.id === tarjetaActual.id);

  // Guarda los elementos de la tarjeta activa en el almacén global
  const sincronizarEscenaActual = useCallback(() => {
    if (!motorRef.current) return;
    const activa = cfgRef.current.tarjetaActiva;
    const activos = motorRef.current.escena.lista();
    const resto = todosElementosRef.current.filter((el) => el.contenedor !== activa);
    todosElementosRef.current = [...resto, ...activos];
  }, []);

  // Obtiene los elementos de una tarjeta para su miniatura: la activa desde la escena del motor, las demás desde memoria
  // (referencia estable: no fuerza el redibujado de todas las miniaturas al cambiar de tarjeta)
  const obtenerLista = useCallback((id) => {
    if (id === cfgRef.current.tarjetaActiva && motorRef.current) {
      return motorRef.current.escena.lista();
    }
    return elementosDeTarjeta(todosElementosRef.current, id);
  }, []);

  // Actualiza la configuración del documento y programa el autoguardado
  const guardarCambioConfig = useCallback((nuevaCfg) => {
    setCfg(nuevaCfg);
    cfgRef.current = nuevaCfg;
    docRef.current = {
      ...docRef.current,
      config: { ...docRef.current.config, ...nuevaCfg },
    };
    autoRef.current?.programar();
  }, []);

  // Encuadra la cámara a las medidas de la tarjeta física
  const encuadrarTarjeta = useCallback(() => {
    const motor = motorRef.current;
    if (!motor) return;
    const r = medidasTarjeta(cfgRef.current.tamano, cfgRef.current.personalizado);
    const c = encuadrar({ x: 0, y: 0, ancho: r.ancho, alto: r.alto }, motor.ancho, motor.alto, 50);
    motor.camara = c;
    motor._camaraCambio();
  }, []);

  // Cambia el tamaño de la tarjeta (16:9, 4:3, A6, A5, personalizado)
  const cambiarTamanoTarjeta = useCallback((nuevoTamano, pers = null) => {
    const persValido = normalizarPersonalizado(pers || cfgRef.current.personalizado);
    const nuevaCfg = {
      ...cfgRef.current,
      tamano: nuevoTamano,
      personalizado: persValido,
    };
    guardarCambioConfig(nuevaCfg);

    const motor = motorRef.current;
    if (motor) {
      const nuevasMed = medidasTarjeta(nuevoTamano, persValido);
      motor.setMarco({ x: 0, y: 0, ancho: nuevasMed.ancho, alto: nuevasMed.alto });
      const c = encuadrar({ x: 0, y: 0, ancho: nuevasMed.ancho, alto: nuevasMed.alto }, motor.ancho, motor.alto, 50);
      motor.camara = c;
      motor._camaraCambio();
      motor.pedirDibujo();
      motor._notificar();
    }
  }, [guardarCambioConfig]);

  // Prepara una escena nueva: al registrar una acción propia se descartan las operaciones de tarjetas por rehacer
  const enlazarEscena = useCallback((escena) => {
    escena.historial.alRegistrar = () => histTarjetasRef.current.limpiarFuturo();
  }, []);

  // Pone en el motor la escena de una tarjeta (con los elementos que hay en memoria).
  // Quita la suscripción de la escena anterior para que no quede ninguna colgada.
  const montarEscena = useCallback((id) => {
    const motor = motorRef.current;
    const nuevaEscena = new Escena(elementosDeTarjeta(todosElementosRef.current, id));
    enlazarEscena(nuevaEscena);
    bajaEscenaInicialRef.current();
    bajaEscenaInicialRef.current = () => {};
    motor._desuscribir?.();
    motor.escena = nuevaEscena;
    motor.setContenedor(id);
    motor._limpiarSeleccion();
    motor._desuscribir = nuevaEscena.suscribir(() => {
      motor._limpiarSeleccion();
      motor.pedirDibujo();
      motor._notificar();
      autoRef.current?.programar();
    });
    return nuevaEscena;
  }, [enlazarEscena]);

  // Inicialización del motor y autoguardado
  useEffect(() => {
    let vivo = true;
    let motor;
    let auto;
    let baja = () => {};
    let bajaEstado = () => {};

    (async () => {
      let elementos;
      try {
        elementos = await listarElementos(doc.id);
      } catch (e) {
        setError(e.message);
        return;
      }
      if (!vivo) return;

      // Documentos antiguos: lo que no pertenece a ninguna tarjeta pasa, una sola vez, a la primera
      const migrados = asignarHuerfanos(elementos, cfgRef.current.tarjetas[0].id);
      elementos = migrados.elementos;
      if (migrados.cambiados.length) {
        try {
          await guardarElementos(migrados.cambiados);
        } catch (e) {
          setError(e.message);
        }
      }
      if (!vivo) return;

      todosElementosRef.current = elementos;
      const escena = new Escena(elementosDeTarjeta(elementos, cfgRef.current.tarjetaActiva));
      enlazarEscena(escena);

      // El autoguardado guarda siempre la escena vigente del motor (cambia al pasar de una tarjeta a otra)
      auto = crearAutoguardado(async () => {
        motorRef.current?.finalizarGestoEnCurso();
        motorRef.current?.puntoDeControlTexto();
        await guardarPendientesDeEscena(() => motorRef.current?.escena || escena, undefined, async ({ guardados, borrados }) => {
          const hayContenido = guardados > 0 || borrados > 0 || tituloSucio.current;
          tituloSucio.current = false;
          await guardarDocumento(docRef.current, { tocarFecha: hayContenido });
        });
      }, { espera: 700 });

      autoRef.current = auto;
      bajaEstado = auto.suscribir(setEstado);
      baja = escena.suscribir(() => auto.programar());
      bajaEscenaInicialRef.current = baja;

      let ajustes = null;
      try {
        ajustes = await obtenerAjuste('lienzo.ajustes', null);
      } catch {
        /* valores por defecto */
      }
      if (!vivo) {
        auto.destruir();
        return;
      }

      const med = medidasTarjeta(cfgRef.current.tamano, cfgRef.current.personalizado);
      const cam = doc.config?.camara || encuadrar({ x: 0, y: 0, ancho: med.ancho, alto: med.alto }, window.innerWidth, window.innerHeight, 50);

      motor = new Lienzo(canvasRef.current, {
        escena,
        documentoId: doc.id,
        camara: cam,
        ajustes,
        capaTexto: capaTextoRef.current,
        escritura: doc.escritura,
        renglones: doc.renglones,
        contenedor: cfgRef.current.tarjetaActiva,
        marco: { x: 0, y: 0, ancho: med.ancho, alto: med.alto },
        alRenglones: (r) => {
          docRef.current = { ...docRef.current, renglones: r };
          auto.programar();
        },
        alAjustes: (a) => {
          guardarAjuste('lienzo.ajustes', a).catch(() => {});
        },
        alCambiar: setUi,
        alImagenError: setError,
        alCamara: (c) => {
          docRef.current = { ...docRef.current, config: { ...docRef.current.config, camara: { ...c } } };
          auto.programar();
        },
      });

      // Cuando la tarjeta activa no tiene nada que deshacer o rehacer, se usan las operaciones sobre la lista de tarjetas
      motor.historialExtra = {
        puedeDeshacer: () => histTarjetasRef.current.puedeDeshacer(),
        puedeRehacer: () => histTarjetasRef.current.puedeRehacer(),
        deshacer: () => aplicarOpRef.current?.(true),
        rehacer: () => aplicarOpRef.current?.(false),
      };

      motorRef.current = motor;
      motor._notificar();
      setCargado(true);

      // Centrar suavemente en la tarjeta
      setTimeout(() => {
        if (vivo && motorRef.current) encuadrarTarjeta();
      }, 50);
    })();

    return () => {
      vivo = false;
      baja();
      bajaEstado();
      motor?.destruir();
      auto?.destruir();
    };
  }, [doc.id]); // Solo se inicializa una vez al montar

  // Cambia a otra tarjeta. Antes de reemplazar la escena se guarda lo pendiente de la que se abandona.
  // extraCfg permite actualizar a la vez la lista de tarjetas (agregar, duplicar).
  const cambiarA = useCallback(async (nuevaId, extraCfg = {}) => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.cerrarTexto();
    try {
      await autoRef.current?.vaciar();
    } catch {
      /* se refleja en estado */
    }

    const dejada = cfgRef.current.tarjetaActiva;
    sincronizarEscenaActual();
    montarEscena(nuevaId);
    marcaMiniaturaRef.current = '';
    marcarRev(dejada);

    guardarCambioConfig({ ...cfgRef.current, ...extraCfg, tarjetaActiva: nuevaId });

    encuadrarTarjeta();
    motor.pedirDibujo();
    motor._notificar();
  }, [sincronizarEscenaActual, montarEscena, marcarRev, guardarCambioConfig, encuadrarTarjeta]);

  const seleccionarTarjeta = useCallback(async (nuevaId) => {
    if (!motorRef.current || nuevaId === cfgRef.current.tarjetaActiva) return;
    await cambiarA(nuevaId);
  }, [cambiarA]);

  // Agregar una tarjeta nueva
  const agregarTarjeta = useCallback(async () => {
    const actual = cfgRef.current;
    const id = nuevoId();
    const nueva = { id, titulo: `Tarjeta ${actual.tarjetas.length + 1}` };
    const lista = [...actual.tarjetas, nueva];
    const activaAntes = actual.tarjetaActiva;
    await cambiarA(id, { tarjetas: lista });
    histTarjetasRef.current.registrar(crearOperacion({
      tipo: 'agregar', tarjeta: nueva, indice: lista.length - 1, existeAntes: false, existeDespues: true, activaAntes, activaDespues: id,
    }));
    motorRef.current?._notificar();
  }, [cambiarA]);

  // Duplicar la tarjeta actual
  const duplicarTarjeta = useCallback(async () => {
    motorRef.current?.cerrarTexto();
    sincronizarEscenaActual();
    const actual = cfgRef.current;
    const origen = actual.tarjetas.find((t) => t.id === actual.tarjetaActiva) || actual.tarjetas[0];
    const id = nuevoId();
    const nueva = { id, titulo: `${origen.titulo} (copia)` };
    const lista = [...actual.tarjetas];
    const pos = lista.findIndex((t) => t.id === origen.id);
    lista.splice(pos + 1, 0, nueva);

    // Duplicar elementos en memoria
    const clonados = duplicarElementosTarjeta(todosElementosRef.current, origen.id, id, nuevoId);
    todosElementosRef.current = [...todosElementosRef.current, ...clonados];

    // Guardar los nuevos elementos en IndexedDB
    try {
      await guardarElementos(clonados);
    } catch (e) {
      setError(e.message);
    }

    await cambiarA(id, { tarjetas: lista });
    histTarjetasRef.current.registrar(crearOperacion({
      tipo: 'duplicar', tarjeta: nueva, indice: pos + 1, existeAntes: false, existeDespues: true, activaAntes: origen.id, activaDespues: id, elementos: clonados,
    }));
    motorRef.current?._notificar();
  }, [sincronizarEscenaActual, cambiarA]);

  // Eliminar la tarjeta actual (se puede deshacer: el contenido queda guardado en la operación)
  const ejecutarEliminacionTarjeta = useCallback(async () => {
    const motor = motorRef.current;
    if (!motor || cfgRef.current.tarjetas.length <= 1) return;
    motor.cerrarTexto();
    try {
      await autoRef.current?.vaciar();
    } catch {
      /* se refleja en estado */
    }
    sincronizarEscenaActual();

    const actual = cfgRef.current;
    const idEliminar = actual.tarjetaActiva;
    const pos = actual.tarjetas.findIndex((t) => t.id === idEliminar);
    const tarjeta = actual.tarjetas[pos];
    const vecina = actual.tarjetas[pos > 0 ? pos - 1 : 1];

    // Borrar de BD todos los elementos de la tarjeta eliminada (se conservan en la operación para poder deshacer)
    const elementos = todosElementosRef.current.filter((el) => el.contenedor === idEliminar);
    if (elementos.length) {
      try {
        await borrarElementos(elementos.map((el) => el.id));
      } catch (e) {
        setError(e.message);
      }
    }
    todosElementosRef.current = todosElementosRef.current.filter((el) => el.contenedor !== idEliminar);

    montarEscena(vecina.id);
    marcaMiniaturaRef.current = '';
    histTarjetasRef.current.registrar(crearOperacion({
      tipo: 'eliminar', tarjeta, indice: pos, existeAntes: true, existeDespues: false, activaAntes: idEliminar, activaDespues: vecina.id, elementos,
    }));
    guardarCambioConfig({
      ...cfgRef.current,
      tarjetas: actual.tarjetas.filter((t) => t.id !== idEliminar),
      tarjetaActiva: vecina.id,
    });

    setConfirmarEliminar(false);
    encuadrarTarjeta();
    motor.pedirDibujo();
    motor._notificar();
  }, [sincronizarEscenaActual, montarEscena, guardarCambioConfig, encuadrarTarjeta]);

  // Deshace (haciaAntes = true) o rehace la última operación sobre la lista de tarjetas
  const aplicarOperacionTarjetas = useCallback(async (haciaAntes) => {
    const motor = motorRef.current;
    const hist = histTarjetasRef.current;
    if (!motor || ocupadoRef.current) return;
    if (haciaAntes ? !hist.puedeDeshacer() : !hist.puedeRehacer()) return;
    ocupadoRef.current = true;
    try {
      motor.cerrarTexto();
      try {
        await autoRef.current?.vaciar();
      } catch {
        /* se refleja en estado */
      }
      sincronizarEscenaActual();

      const op = haciaAntes ? hist.tomarDeshacer() : hist.tomarRehacer();
      const actual = cfgRef.current;
      const r = aplicarOperacion(actual.tarjetas, op, haciaAntes);
      if (!r) {
        // No se puede aplicar (dejaría el documento sin tarjetas): la operación vuelve a su lugar
        if (haciaAntes) hist.pasado.push(hist.futuro.pop()); else hist.futuro.push(hist.pasado.pop());
        return;
      }

      if (r.quitar) {
        const vigente = actual.tarjetas.find((t) => t.id === op.tarjeta.id);
        if (vigente) op.tarjeta = { ...vigente };
        op.elementos = todosElementosRef.current.filter((el) => el.contenedor === op.tarjeta.id);
        if (op.elementos.length) {
          try {
            await borrarElementos(op.elementos.map((el) => el.id));
          } catch (e) {
            setError(e.message);
          }
        }
        todosElementosRef.current = todosElementosRef.current.filter((el) => el.contenedor !== op.tarjeta.id);
      } else if (r.restaurar && op.elementos.length) {
        todosElementosRef.current = [...todosElementosRef.current, ...op.elementos];
        try {
          await guardarElementos(op.elementos);
        } catch (e) {
          setError(e.message);
        }
      }

      montarEscena(r.activa);
      marcaMiniaturaRef.current = '';
      marcarRev(r.activa, op.tarjeta.id);
      guardarCambioConfig({ ...cfgRef.current, tarjetas: r.tarjetas, tarjetaActiva: r.activa });
      encuadrarTarjeta();
      motor.pedirDibujo();
      motor._notificar();
    } finally {
      ocupadoRef.current = false;
    }
  }, [sincronizarEscenaActual, montarEscena, marcarRev, guardarCambioConfig, encuadrarTarjeta]);

  useEffect(() => { aplicarOpRef.current = aplicarOperacionTarjetas; }, [aplicarOperacionTarjetas]);

  // Renombrar tarjeta actual
  const cambiarTituloTarjeta = useCallback((nuevo) => {
    const lista = cfg.tarjetas.map((t) => (t.id === tarjetaActual.id ? { ...t, titulo: nuevo } : t));
    guardarCambioConfig({ ...cfgRef.current, tarjetas: lista });
  }, [cfg.tarjetas, tarjetaActual.id, guardarCambioConfig]);

  // Reordenar tarjetas arrastrando o con atajos de teclado manteniendo la tarjeta activa
  const reordenarTarjetas = useCallback((desde, hasta) => {
    if (desde === hasta) return;
    const nuevaLista = moverTarjeta(cfgRef.current.tarjetas, desde, hasta);
    guardarCambioConfig({
      ...cfgRef.current,
      tarjetas: nuevaLista,
      tarjetaActiva: cfgRef.current.tarjetaActiva,
    });
  }, [guardarCambioConfig]);

  // Modo estudio: antes de abrirlo se termina cualquier edición de texto en curso
  const abrirEstudio = useCallback(() => {
    motorRef.current?.cerrarTexto();
    setMostrarEstudio(true);
  }, []);

  // Preparar e iniciar impresión con construirHojasTarjetas
  const ejecutarImpresion = useCallback(async () => {
    const cont = document.getElementById('nt-area-impresion-tarjetas');
    if (!cont) return;

    const tarjetasAImprimir = modoImpresion === 'actual'
      ? [tarjetaActual]
      : cfg.tarjetas;

    sincronizarEscenaActual();
    const recursosImagen = await prepararImagenes(todosElementosRef.current);
    const med = medidasTarjeta(cfg.tamano, cfg.personalizado);
    const factor = factorResolucion(tarjetasAImprimir.length, { alto: 2, medio: 2, bajo: 1.5 });

    try { construirHojasTarjetas(cont, {
      tarjetas: tarjetasAImprimir,
      med,
      porHoja,
      marcas: marcasDeCorte,
      titulo: docRef.current.titulo || doc.titulo,
      factor,
      dibujarEn: (cv, tarjeta, idx, f) => {
        const cx = cv.getContext('2d');
        const esActiva = tarjeta.id === tarjetaActual.id && motorRef.current;
        const escenaAUsar = esActiva
          ? motorRef.current.escena
          : new Escena(elementosDeTarjeta(todosElementosRef.current, tarjeta.id));
        const lista = escenaAUsar.lista();

        dibujar(cx, {
          camara: { x: 0, y: 0, zoom: 1 },
          ancho: med.ancho,
          alto: med.alto,
          dpr: f,
          lista,
          escena: escenaAUsar,
          seleccion: new Set(),
          marco: null,
          mostrarManijas: null,
          renglones: imprimirRenglones ? { cfg: docRef.current.renglones, opacidad: 1 } : null,
          guiaTexto: docRef.current.renglones,
          marcoDocumento: { x: 0, y: 0, ancho: med.ancho, alto: med.alto },
        });
      },
    }); } finally { recursosImagen.liberar(); }

    setModalImprimir(false);
    imprimirContenedor(cont);
  }, [modoImpresion, tarjetaActual, cfg.tarjetas, cfg.tamano, cfg.personalizado, porHoja, marcasDeCorte, imprimirRenglones, doc.titulo, sincronizarEscenaActual]);

  const [exportando, setExportando] = useState(false);

  const ejecutarExportar = useCallback(async () => {
    if (exportando) return;
    setExportando(true);
    try {
      motorRef.current?.cerrarTexto();
      await autoRef.current?.vaciar();
      sincronizarEscenaActual();
      await exportarDocumento(docRef.current, { elementos: todosElementosRef.current, compartir: true });
    } catch (err) {
      setError('No se pudo exportar la nota: ' + err.message);
    } finally {
      setExportando(false);
    }
  }, [exportando, sincronizarEscenaActual]);

  async function salir() {
    motorRef.current?.finalizarGestoEnCurso();
    motorRef.current?.cerrarTexto();
    try {
      await autoRef.current?.vaciar();
    } catch {
      /* se refleja en estado */
    }
    volver();
  }

  function cambiarTituloDoc(v) {
    setTitulo(v);
    docRef.current = { ...docRef.current, titulo: v.trim() || 'Sin título' };
    tituloSucio.current = true;
    autoRef.current?.programar();
  }

  const m = () => motorRef.current;
  const sel = (ui?.seleccionados || 0) > 0;
  const herr = ui?.herramienta;
  const modo = doc.escritura || 'ambos';
  const conMano = modo !== 'teclado';
  const conTeclado = modo !== 'mano';

  return (
    <div className="nt-editor nt-editor--tarjetas">
      <header className="nt-ed-cab">
        <button className="nt-btn" onClick={salir}>← Biblioteca</button>
        <input className="nt-ed-titulo" aria-label="Título del documento" value={titulo} onChange={(e) => cambiarTituloDoc(e.target.value)} />
        <button
          ref={botonTamanoRef}
          type="button"
          className="nt-btn nt-btn--tamano"
          onClick={abrirMenuTamano}
          aria-haspopup="dialog"
          aria-expanded={menuTamanoAbierto}
          title="Cambiar proporción o tamaño de las tarjetas"
        >
          Tamaño: {medidas.nombre} ▾
        </button>
        <button
          type="button"
          className={`nt-btn ${mostrarTira ? 'nt-btn--on' : ''}`}
          onClick={() => setMostrarTira((v) => !v)}
          title="Mostrar u ocultar tira lateral de tarjetas"
          aria-pressed={mostrarTira}
        >
          Tira
        </button>
        <button
          type="button"
          className="nt-btn"
          onClick={abrirEstudio}
          title="Modo estudio: repasar las tarjetas a pantalla completa, sin editar"
        >
          Estudiar
        </button>
        <button
          type="button"
          className="nt-btn"
          onClick={() => setMostrarCuadricula(true)}
          title="Ver todas las tarjetas en cuadrícula a pantalla completa"
        >
          Cuadrícula
        </button>
        <span className={`nt-estado ${estado === 'guardado' ? 'nt-estado--ok' : ''} ${estado.startsWith('error') ? 'nt-estado--error' : ''}`} aria-live="polite">
          {TEXTO_ESTADO[estado] || TEXTO_ESTADO.error}
        </span>
        <Boton icono="imprimir" nombre="Imprimir o exportar tarjetas" alPulsar={() => setModalImprimir(true)} />
        <Boton icono="exportar" nombre="Exportar nota (.nota)" deshabilitado={exportando} alPulsar={ejecutarExportar} />
        <Boton icono="deshacer" nombre="Deshacer (Ctrl+Z)" conservarFoco deshabilitado={!ui?.puedeDeshacer} alPulsar={() => m()?.deshacer()} />
        <Boton icono="rehacer" nombre="Rehacer (Ctrl+Y)" conservarFoco deshabilitado={!ui?.puedeRehacer} alPulsar={() => m()?.rehacer()} />
      </header>

      {menuTamanoAbierto && (
        <div
          ref={panelTamanoRef}
          className="nt-panel-tamano"
          role="dialog"
          aria-label="Tamaño de tarjeta"
          style={posTamano}
        >
          <div style={{ display: 'grid', gap: '10px' }}>
            <label style={{ display: 'grid', gap: '4px', fontWeight: 500, fontSize: '13px' }}>
              Formato de tarjeta
              <select
                className="nt-campo"
                value={cfg.tamano}
                onChange={(e) => {
                  const val = e.target.value;
                  cambiarTamanoTarjeta(val, { anchoMm: anchoMmPers, altoMm: altoMmPers });
                }}
              >
                <option value="16:9">16:9 (Panorámica)</option>
                <option value="4:3">4:3 (Estándar)</option>
                <option value="A6">A6 (Ficha clásica, 148 × 105 mm)</option>
                <option value="A5">A5 (Ficha grande, 210 × 148 mm)</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </label>

            {cfg.tamano === 'personalizado' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                  Ancho (mm)
                  <input
                    type="number"
                    className="nt-campo"
                    min={40}
                    max={400}
                    value={anchoMmPers}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAnchoMmPers(v);
                      const n = Number(v);
                      if (Number.isFinite(n) && n >= 40 && n <= 400) {
                        cambiarTamanoTarjeta('personalizado', { anchoMm: n, altoMm: Number(altoMmPers) });
                      }
                    }}
                    onBlur={() => {
                      const norm = normalizarPersonalizado({ anchoMm: anchoMmPers, altoMm: altoMmPers });
                      setAnchoMmPers(norm.anchoMm);
                      setAltoMmPers(norm.altoMm);
                      cambiarTamanoTarjeta('personalizado', norm);
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
                  Alto (mm)
                  <input
                    type="number"
                    className="nt-campo"
                    min={40}
                    max={400}
                    value={altoMmPers}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAltoMmPers(v);
                      const n = Number(v);
                      if (Number.isFinite(n) && n >= 40 && n <= 400) {
                        cambiarTamanoTarjeta('personalizado', { anchoMm: Number(anchoMmPers), altoMm: n });
                      }
                    }}
                    onBlur={() => {
                      const norm = normalizarPersonalizado({ anchoMm: anchoMmPers, altoMm: altoMmPers });
                      setAnchoMmPers(norm.anchoMm);
                      setAltoMmPers(norm.altoMm);
                      cambiarTamanoTarjeta('personalizado', norm);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="nt-ed-trabajo">
        <nav className="nt-riel" aria-label="Herramientas">
          <Boton icono="seleccionar" nombre="Seleccionar (Alt+V)" activo={herr === 'seleccionar'} alPulsar={() => m()?.setHerramienta('seleccionar')} />
          <Boton icono="mano" nombre="Mover el lienzo (Alt+H)" activo={herr === 'mano'} alPulsar={() => m()?.setHerramienta('mano')} />
          {conMano && <Boton icono="lapiz" nombre="Lápiz (Alt+P)" activo={herr === 'lapiz'} alPulsar={() => m()?.setHerramienta('lapiz')} />}
          {conMano && <Boton icono="resaltador" nombre="Resaltador (Alt+M)" activo={herr === 'resaltador'} alPulsar={() => m()?.setHerramienta('resaltador')} />}
          {conMano && <Boton icono="borrador" nombre="Borrador (Alt+B)" activo={herr === 'borrador'} alPulsar={() => m()?.setHerramienta('borrador')} />}
          {conTeclado && <Boton icono="texto" nombre="Texto por cuadro (Alt+T)" activo={herr === 'texto'} alPulsar={() => m()?.setHerramienta('texto')} />}
          <InsertarImagen motorRef={motorRef} />
          <MenuFormas herramienta={herr} ultima={ES_FORMA(herr) ? herr : ultimaForma} alElegir={(f) => { setUltimaForma(f); m()?.setHerramienta(f); }} />
          <hr />
          <Boton icono="frente" nombre="Traer al frente" deshabilitado={!sel} alPulsar={() => m()?.reordenar('frente')} />
          <Boton icono="subir" nombre="Subir una capa" deshabilitado={!sel} alPulsar={() => m()?.reordenar('subir')} />
          <Boton icono="bajar" nombre="Bajar una capa" deshabilitado={!sel} alPulsar={() => m()?.reordenar('bajar')} />
          <Boton icono="fondo" nombre="Enviar al fondo" deshabilitado={!sel} alPulsar={() => m()?.reordenar('fondo')} />
          <hr />
          <Boton icono="eliminar" nombre="Eliminar (Supr)" deshabilitado={!sel} alPulsar={() => m()?.eliminarSeleccion()} />
        </nav>

        {mostrarTira && (
          <TiraTarjetas
            tarjetas={cfg.tarjetas}
            tarjetaActivaId={tarjetaActual.id}
            med={medidas}
            obtenerLista={obtenerLista}
            revs={revs}
            renglones={docRef.current.renglones}
            onSeleccionar={seleccionarTarjeta}
            onReordenar={reordenarTarjetas}
            onAgregar={agregarTarjeta}
            onDuplicar={duplicarTarjeta}
          />
        )}

        <div className="nt-lienzo">
          <canvas ref={canvasRef} tabIndex={0} aria-label="Ficha de tarjeta" />
          <div className="nt-capa-texto" ref={capaTextoRef} />

          {ui && ['lapiz', 'resaltador', 'borrador'].includes(herr) && <Propiedades ui={ui} motorRef={motorRef} />}
          {ui && (ES_FORMA(herr) || (herr === 'seleccionar' && ui.figura.seleccionadas > 0)) && <PanelFigura estilo={ui.figura} motorRef={motorRef} />}
          {ui?.imagenSeleccionada && <PanelImagen imagen={ui.imagenSeleccionada} motorRef={motorRef} />}
          {ui?.texto && <BarraTexto estado={ui.texto} motorRef={motorRef} />}

          {!cargado && !error && <p className="nt-lienzo__aviso">Cargando tarjeta…</p>}
          {error && <p className="nt-aviso nt-lienzo__aviso" role="alert">{error}</p>}

          <div className="nt-zoom" role="group" aria-label="Zoom">
            <button className="nt-ib" aria-label="Alejar" onClick={() => m()?.zoomPaso(1 / 1.25)}>−</button>
            <button className="nt-zoom__valor" onClick={() => encuadrarTarjeta()} title="Encuadrar tarjeta">{ui?.zoom ?? 100} %</button>
            <button className="nt-ib" aria-label="Acercar" onClick={() => m()?.zoomPaso(1.25)}>+</button>
            <button className="nt-btn" onClick={encuadrarTarjeta}>Encuadrar</button>
            {ui && <MenuRenglones renglones={ui.renglones} motorRef={motorRef} />}
          </div>

          {sel && <div className="nt-seleccion">{ui.seleccionados} seleccionado{ui.seleccionados > 1 ? 's' : ''}</div>}

          {/* Barra inferior de navegación entre tarjetas */}
          <div className="nt-barra-tarjetas" role="region" aria-label="Navegación de tarjetas">
            <div className="nt-tarjetas-nav">
              <button
                className="nt-ib"
                disabled={indiceActual <= 0}
                title="Tarjeta anterior"
                aria-label="Tarjeta anterior"
                onClick={() => seleccionarTarjeta(cfg.tarjetas[indiceActual - 1].id)}
              >
                ←
              </button>
              <span className="nt-tarjeta-indicador">
                {indiceActual + 1} / {cfg.tarjetas.length}
              </span>
              <button
                className="nt-ib"
                disabled={indiceActual >= cfg.tarjetas.length - 1}
                title="Tarjeta siguiente"
                aria-label="Tarjeta siguiente"
                onClick={() => seleccionarTarjeta(cfg.tarjetas[indiceActual + 1].id)}
              >
                →
              </button>
            </div>

            <input
              className="nt-tarjeta-titulo-input"
              value={tarjetaActual.titulo}
              onChange={(e) => cambiarTituloTarjeta(e.target.value)}
              placeholder="Nombre de tarjeta…"
              title="Nombre de la tarjeta activa"
              aria-label="Nombre de la tarjeta activa"
            />

            <div className="nt-tarjetas-chips" aria-label="Selector rápido de fichas">
              {cfg.tarjetas.map((t, idx) => (
                <button
                  key={t.id}
                  className={`nt-tarjeta-chip ${t.id === tarjetaActual.id ? 'nt-tarjeta-chip--activa' : ''}`}
                  onClick={() => seleccionarTarjeta(t.id)}
                  title={t.titulo || `Tarjeta ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <span className="nt-separador-v" />

            <button className="nt-btn" onClick={agregarTarjeta} title="Crear nueva ficha vacía">+ Nueva</button>
            <button className="nt-btn" onClick={duplicarTarjeta} title="Duplicar ficha y contenido">Duplicar</button>
            <button
              className="nt-btn"
              disabled={cfg.tarjetas.length <= 1}
              onClick={() => setConfirmarEliminar(true)}
              title={cfg.tarjetas.length <= 1 ? 'Debe haber al menos una tarjeta' : 'Eliminar esta tarjeta'}
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Impresión */}
      {modalImprimir && (
        <Modal titulo="Imprimir o exportar tarjetas" alCerrar={() => setModalImprimir(false)} ancho={500}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <p className="nt-texto-suave" style={{ margin: 0 }}>
              Prepare sus tarjetas para imprimirlas en papel o guardarlas como archivo PDF de estudio.
            </p>

            <div className="nt-fila nt-campos">
              <label>
                Alcance
                <select className="nt-campo" value={modoImpresion} onChange={(e) => setModoImpresion(e.target.value)}>
                  <option value="todas">Todas las tarjetas ({cfg.tarjetas.length})</option>
                  <option value="actual">Solo la tarjeta actual (#{indiceActual + 1})</option>
                </select>
              </label>

              <label>
                Proporción
                <input className="nt-campo" value={medidas.nombre} disabled />
              </label>
            </div>

            <div className="nt-fila nt-campos">
              <label>
                Tarjetas por hoja
                <select
                  className="nt-campo"
                  value={porHoja}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPorHoja(v);
                    guardarCambioConfig({ ...cfgRef.current, porHoja: v });
                  }}
                >
                  <option value={1}>1 tarjeta por hoja</option>
                  <option value={2}>2 tarjetas por hoja</option>
                  <option value={4}>4 tarjetas por hoja</option>
                  <option value={6}>6 tarjetas por hoja</option>
                </select>
              </label>
            </div>

            <label className="nt-check" style={{ marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={marcasDeCorte}
                onChange={(e) => {
                  setMarcasDeCorte(e.target.checked);
                  guardarCambioConfig({ ...cfgRef.current, marcasDeCorte: e.target.checked });
                }}
              />
              Marcas de corte
            </label>

            <label className="nt-check" style={{ marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={imprimirRenglones}
                onChange={(e) => {
                  setImprimirRenglones(e.target.checked);
                  guardarCambioConfig({ ...cfgRef.current, imprimirRenglones: e.target.checked });
                }}
              />
              Incluir renglones y cuadrícula de fondo al imprimir
            </label>

            <div className="nt-acciones" style={{ marginTop: '12px' }}>
              <button type="button" className="nt-btn" onClick={() => setModalImprimir(false)}>Cancelar</button>
              <button type="button" className="nt-btn nt-btn--primario" onClick={ejecutarImpresion}>
                Imprimir ahora
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmar Eliminación */}
      {confirmarEliminar && (
        <Modal titulo="¿Eliminar esta tarjeta?" alCerrar={() => setConfirmarEliminar(false)} ancho={440}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <p style={{ margin: 0 }}>
              Se eliminará <strong>«{tarjetaActual.titulo}»</strong> y todos los dibujos y textos contenidos en ella. Podrá recuperarla con «Deshacer».
            </p>
            <div className="nt-acciones">
              <button type="button" className="nt-btn" onClick={() => setConfirmarEliminar(false)}>Cancelar</button>
              <button type="button" className="nt-btn" style={{ background: '#d6336c', color: '#fff', borderColor: '#d6336c' }} onClick={ejecutarEliminacionTarjeta}>
                Eliminar tarjeta
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Cuadrícula a pantalla completa */}
      {mostrarCuadricula && (
        <CuadriculaTarjetas
          tarjetas={cfg.tarjetas}
          tarjetaActivaId={tarjetaActual.id}
          med={medidas}
          obtenerLista={obtenerLista}
          revs={revs}
          renglones={docRef.current.renglones}
          onSeleccionar={seleccionarTarjeta}
          onReordenar={reordenarTarjetas}
          onCerrar={() => setMostrarCuadricula(false)}
        />
      )}

      {/* Modo estudio: pantalla completa, solo lectura */}
      {mostrarEstudio && (
        <EstudioTarjetas
          tarjetas={cfg.tarjetas}
          indiceInicial={Math.max(0, indiceActual)}
          med={medidas}
          obtenerLista={obtenerLista}
          renglones={docRef.current.renglones}
          onSalir={() => setMostrarEstudio(false)}
        />
      )}

      {/* Contenedor invisible en pantalla normal, visible solo con window.print() */}
      <div id="nt-area-impresion-tarjetas" className="nt-area-impresion-tarjetas" aria-hidden="true" />
    </div>
  );
}
