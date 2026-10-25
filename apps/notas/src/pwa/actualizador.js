// Actualización automática del programa de computadora (Windows, Mac y Linux), con el actualizador de Tauri.
// La app consulta en segundo plano si hay una versión nueva; la persona elige cuándo instalarla, y antes de
// hacerlo se guarda todo (documentos abiertos y archivos vinculados). Sin React y con la conexión inyectada.
import { EVENTO_GUARDAR_TODO } from './gestor.js';

// Cada cuánto se vuelve a consultar con la app abierta (seis horas) y cuánto se espera tras abrirla (para no frenar el arranque)
export const INTERVALO_CONSULTA_MS = 6 * 60 * 60 * 1000;
export const ESPERA_INICIAL_MS = 4000;

export function crearActualizador({
  api, // { buscar(): Promise<{ version, notas, instalar(avance) } | null>, reiniciar(): Promise<void> }
  guardarTodo, // async () => void: guarda documentos y archivos pendientes
}) {
  let estado = { fase: 'nada', version: null, notas: '', progreso: null, error: '' };
  let pendiente = null; // la actualización encontrada
  const oyentes = new Set();
  const poner = (cambios) => { estado = { ...estado, ...cambios }; oyentes.forEach((f) => f(estado)); };

  // Consulta si hay versión nueva. Si no hay conexión o todavía no se publicó nada, no molesta: queda en silencio.
  async function consultar() {
    if (estado.fase === 'instalando' || estado.fase === 'lista') return estado;
    try {
      const hallada = await api.buscar();
      if (hallada) { pendiente = hallada; poner({ fase: 'lista', version: hallada.version, notas: hallada.notas || '', error: '' }); }
    } catch { /* sin conexión, límite de GitHub o aún sin publicación: se vuelve a intentar más tarde */ }
    return estado;
  }

  // Guarda todo, descarga e instala, y reinicia el programa. Devuelve true si llegó a reiniciar.
  async function instalar() {
    if (!pendiente || estado.fase === 'instalando') return false;
    poner({ fase: 'instalando', progreso: 0, error: '' });
    try {
      await guardarTodo();
      let total = 0; let bajado = 0;
      await pendiente.instalar((evento) => {
        if (evento.evento === 'Started') total = evento.datos?.contentLength || 0;
        else if (evento.evento === 'Progress') { bajado += evento.datos?.chunkLength || 0; if (total) poner({ progreso: Math.min(99, Math.round((bajado / total) * 100)) }); }
        else if (evento.evento === 'Finished') poner({ progreso: 100 });
      });
      await api.reiniciar();
      return true;
    } catch {
      poner({ fase: 'lista', progreso: null, error: 'No se pudo instalar la versión nueva. Sus notas están a salvo; puede intentarlo de nuevo.' });
      return false;
    }
  }

  return { estado: () => estado, suscribir(f) { oyentes.add(f); return () => oyentes.delete(f); }, consultar, instalar };
}

// Conexión real con el actualizador de Tauri (se carga solo cuando hace falta)
export function crearApiActualizador() {
  return {
    async buscar() {
      const { check } = await import('@tauri-apps/plugin-updater');
      const u = await check();
      if (!u) return null;
      return {
        version: u.version, notas: u.body || '',
        instalar: (avance) => u.downloadAndInstall((e) => avance({ evento: e.event, datos: e.data })),
      };
    },
    async reiniciar() {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    },
  };
}

// Guardar todo antes de actualizar: documentos abiertos en el editor y archivos vinculados
export async function guardarTodoAntesDeActualizar(win = globalThis.window, vaciarArchivos = async () => {}) {
  const promesas = [];
  win.dispatchEvent(new win.CustomEvent(EVENTO_GUARDAR_TODO, { detail: { promesas } }));
  await Promise.all(promesas);
  await vaciarArchivos(); // los archivos se escriben cuando el editor ya guardó
}
