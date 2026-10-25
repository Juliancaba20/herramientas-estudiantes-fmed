import { useEffect, useRef, useState } from 'react';
import { activarGuardadoEnArchivos, discoDelPrograma, archivoDesdeDisco } from '../archivos/disco.js';
import { exportarDocumento } from '../archivos/exportar.js';
import { obtenerDocumento } from '../almacen/index.js';
import { guardarTodoAntesDeActualizar } from '../pwa/actualizador.js';

// Todo lo que hace falta en la ventana del programa de computadora para trabajar con archivos reales:
//  · activa la escritura automática de los archivos vinculados y repasa los que quedaron atrás al abrir
//  · avisa si un archivo ya no está o no se pudo escribir
//  · abre el documento cuando se hace doble clic en un .nota (con el programa cerrado o ya abierto)
//  · Ctrl+S: guarda (y si el documento no tiene archivo todavía, pregunta dónde guardarlo)
export default function GuardadoEnArchivos({ pantalla, doc, alAbrirArchivos }) {
  const [aviso, setAviso] = useState(null); // { texto, tipo: 'ok' | 'error' }
  const abrirRef = useRef(alAbrirArchivos);
  useEffect(() => { abrirRef.current = alAbrirArchivos; });
  const temporizador = useRef(null);

  const poner = (texto, tipo = 'ok') => {
    setAviso({ texto, tipo });
    clearTimeout(temporizador.current);
    if (tipo === 'ok') temporizador.current = setTimeout(() => setAviso(null), 4000);
  };
  const ponerRef = useRef(poner);
  useEffect(() => { ponerRef.current = poner; });

  useEffect(() => {
    const disco = discoDelPrograma();
    const desactivar = activarGuardadoEnArchivos();
    let vivo = true;
    let dejarDeEscuchar = () => {};

    disco.sincronizarAlIniciar().then((faltantes) => {
      if (!vivo || faltantes.length === 0) return;
      const resto = faltantes.length > 1 ? ` y de ${faltantes.length - 1} nota${faltantes.length > 2 ? 's' : ''} más` : '';
      ponerRef.current(`No se encontró el archivo de «${faltantes[0].titulo}»${resto} en ${faltantes[0].ruta}. Las notas siguen en Anotomía: guárdelas de nuevo con «Guardar como archivo…».`, 'error');
    }).catch(() => {});

    const bajaErrores = disco.suscribirErrores(({ titulo, ruta }) => {
      ponerRef.current(`No se pudo guardar «${titulo}» en ${ruta}. Sus cambios están a salvo en Anotomía. Revise que el archivo no esté abierto en otro programa o use «Guardar como archivo…».`, 'error');
    });

    const abrirRuta = async (ruta) => {
      try { abrirRef.current([archivoDesdeDisco(await disco.leerRuta(ruta))]); }
      catch (e) { ponerRef.current('No se pudo abrir el archivo: ' + (e?.message || e), 'error'); }
    };
    (async () => {
      try {
        const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]);
        const inicial = await invoke('archivo_inicial'); // documento con el que se abrió el programa (doble clic)
        if (vivo && inicial) abrirRuta(inicial);
        const baja = await listen('anotomia://abrir-archivo', (e) => abrirRuta(e.payload)); // con el programa ya abierto
        if (vivo) dejarDeEscuchar = baja; else baja();
      } catch { /* fuera del programa no hay con qué comunicarse */ }
    })();

    return () => { vivo = false; desactivar(); bajaErrores(); dejarDeEscuchar(); clearTimeout(temporizador.current); };
  }, []);

  // Ctrl+S (o Cmd+S en Mac) con un documento abierto
  useEffect(() => {
    if (pantalla !== 'editor' || !doc) return undefined;
    const alTecla = async (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 's') return;
      e.preventDefault();
      try {
        await guardarTodoAntesDeActualizar(window); // lo que el editor tenga pendiente entra primero
        const actual = await obtenerDocumento(doc.id);
        if (!actual) return;
        const disco = discoDelPrograma();
        const ruta = await disco.rutaDe(actual.id);
        if (ruta) {
          if (await disco.escribirYa(actual.id)) ponerRef.current(`Guardado en ${ruta}.`);
        } else {
          const r = await exportarDocumento(actual, { compartir: false });
          if (r.ruta) ponerRef.current(`Guardado en ${r.ruta}.`);
        }
      } catch (err) { ponerRef.current('No se pudo guardar: ' + (err?.message || err), 'error'); }
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [pantalla, doc]);

  if (!aviso) return null;
  return (
    <div className="nt-aviso-pwa" role={aviso.tipo === 'error' ? 'alert' : 'status'} aria-live="polite">
      <span>{aviso.texto}</span>
      <div className="nt-aviso-pwa__acciones">
        <button type="button" className="nt-btn nt-btn--sm" onClick={() => setAviso(null)}>Entendido</button>
      </div>
    </div>
  );
}
