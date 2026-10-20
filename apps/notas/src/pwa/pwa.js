// Conexión del gestor de la app instalable con React.
import { useSyncExternalStore } from 'react';
import { crearGestorPWA } from './gestor.js';

const gestor = crearGestorPWA({
  urlSW: `${import.meta.env.BASE_URL}sw.js`,
  produccion: import.meta.env.PROD, // en desarrollo no hay service worker: taparía los cambios del código
});

// Debe llamarse una sola vez, lo antes posible (el aviso de instalación del navegador llega temprano).
export function iniciarPWA() { gestor.iniciar(); }

export function usePWA() {
  const estado = useSyncExternalStore(gestor.suscribir, gestor.obtener);
  return { ...estado, aplicarActualizacion: gestor.aplicarActualizacion, instalar: gestor.instalar };
}
