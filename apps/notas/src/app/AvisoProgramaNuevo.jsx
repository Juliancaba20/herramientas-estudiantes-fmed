import { useEffect, useMemo, useState } from 'react';
import { crearActualizador, crearApiActualizador, guardarTodoAntesDeActualizar, ESPERA_INICIAL_MS, INTERVALO_CONSULTA_MS } from '../pwa/actualizador.js';
import { discoDelPrograma } from '../archivos/disco.js';

// Aviso «hay una versión nueva» del programa de computadora. La actualización la elige la persona;
// antes de instalar se guarda todo y al terminar el programa se reinicia solo.
export default function AvisoProgramaNuevo() {
  const actualizador = useMemo(() => crearActualizador({
    api: crearApiActualizador(),
    guardarTodo: () => guardarTodoAntesDeActualizar(window, () => discoDelPrograma().vaciar()),
  }), []);
  const [estado, setEstado] = useState(actualizador.estado());
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const baja = actualizador.suscribir(setEstado);
    const primera = setTimeout(() => actualizador.consultar(), ESPERA_INICIAL_MS);
    const repetida = setInterval(() => actualizador.consultar(), INTERVALO_CONSULTA_MS);
    return () => { baja(); clearTimeout(primera); clearInterval(repetida); };
  }, [actualizador]);

  if (estado.fase === 'nada' || oculto) return null;
  const instalando = estado.fase === 'instalando';
  return (
    <div className="nt-aviso-pwa" role="status" aria-live="polite">
      <span>
        {instalando
          ? `Instalando la versión ${estado.version}${estado.progreso != null ? ` (${estado.progreso} %)` : ''}… El programa se reiniciará solo.`
          : `Hay una versión nueva de Anotomía (${estado.version}). Sus notas se guardarán antes de actualizar.`}
        {estado.error && <strong> {estado.error}</strong>}
      </span>
      {!instalando && (
        <div className="nt-aviso-pwa__acciones">
          <button type="button" className="nt-btn nt-btn--primario nt-btn--sm" onClick={() => actualizador.instalar()}>Actualizar ahora</button>
          <button type="button" className="nt-btn nt-btn--sm" onClick={() => setOculto(true)}>Más tarde</button>
        </div>
      )}
    </div>
  );
}
