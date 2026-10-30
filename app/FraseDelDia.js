'use client';

import { useEffect, useState } from 'react';
import frases from '../content/frases.json';
import { MESES, dos, indiceDelAnio, msHastaMedianoche, nivelDeLargo } from './lib/frase-del-dia';

// Se calcula en el navegador con la fecha local de cada visitante: la frase cambia a las 00:00 de SU lugar.
function hoy() {
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

export default function FraseDelDia() {
  const [fecha, setFecha] = useState(null);

  useEffect(() => {
    let temporizador;
    const actualizar = () => {
      const f = hoy();
      setFecha((prev) => (prev && prev.mes === f.mes && prev.dia === f.dia && prev.anio === f.anio ? prev : f));
    };
    const programar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { actualizar(); programar(); }, msHastaMedianoche() + 500);
    };
    const alVolver = () => { if (!document.hidden) { actualizar(); programar(); } };
    actualizar();
    programar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, []);

  if (!fecha) {
    return <section className="frase frase-carga" aria-label="Frase del día" aria-busy="true"><div className="frase-esqueleto" aria-hidden="true" /></section>;
  }

  const f = frases[indiceDelAnio(fecha.mes, fecha.dia)];
  const etiqueta = `${fecha.dia} de ${MESES[fecha.mes - 1]}`;

  return (
    <section className="frase" aria-labelledby="frase-rotulo" data-largo={nivelDeLargo(f.t)}>
      <p className="frase-rotulo" id="frase-rotulo">
        Frase del día · <time dateTime={`${fecha.anio}-${dos(fecha.mes)}-${dos(fecha.dia)}`}>{etiqueta}</time>
      </p>
      <figure>
        <blockquote><p lang="es">{f.t}</p></blockquote>
        <figcaption>
          <span className="frase-autor">{f.a}</span>
          <span className="frase-obra">{f.o}</span>
        </figcaption>
      </figure>
    </section>
  );
}
