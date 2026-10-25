// Conexión del gestor de la app instalable con React.
import { useSyncExternalStore } from 'react';
import { crearGestorPWA } from './gestor.js';
import { esProgramaEscritorio } from './escritorio.js';

const gestor = crearGestorPWA({
  urlSW: `${import.meta.env.BASE_URL}sw.js`,
  // En desarrollo no hay service worker (taparía los cambios del código) y dentro del programa de escritorio
  // tampoco: allí los archivos de la app ya viajan dentro del .exe y se actualizan al instalar la versión nueva.
  produccion: import.meta.env.PROD && !esProgramaEscritorio(),
});

// Debe llamarse una sola vez, lo antes posible (el aviso de instalación del navegador llega temprano).
export function iniciarPWA() { gestor.iniciar(); }

export function usePWA() {
  const estado = useSyncExternalStore(gestor.suscribir, gestor.obtener);
  return { ...estado, aplicarActualizacion: gestor.aplicarActualizacion, instalar: gestor.instalar };
}
