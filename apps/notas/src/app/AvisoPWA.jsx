import { useState } from 'react';
import { usePWA } from '../pwa/pwa.js';

// Aviso «hay una versión nueva»: la actualización nunca es automática, la elige la persona.
// Antes de recargar se guarda todo lo que haya pendiente en el editor abierto.
export default function AvisoPWA() {
  const { actualizacionLista, aplicarActualizacion } = usePWA();
  const [ocultoHasta, setOcultoHasta] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  if (!actualizacionLista || ocultoHasta) return null;
  return (
    <div className="nt-aviso-pwa" role="status" aria-live="polite">
      <span>Hay una versión nueva de Anotomía. Sus notas se guardarán antes de actualizar.</span>
      <div className="nt-aviso-pwa__acciones">
        <button type="button" className="nt-btn nt-btn--primario nt-btn--sm" disabled={actualizando}
          onClick={async () => { setActualizando(true); const ok = await aplicarActualizacion(); if (!ok) setActualizando(false); }}>
          {actualizando ? 'Actualizando…' : 'Actualizar ahora'}
        </button>
        <button type="button" className="nt-btn nt-btn--sm" onClick={() => setOcultoHasta(true)}>Más tarde</button>
      </div>
    </div>
  );
}
