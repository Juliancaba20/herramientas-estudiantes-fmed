import { useEffect, useRef } from 'react';

// Minimapa del pizarrón (Etapa 7). El dibujo y los gestos los maneja lienzo/minimapa.js.
export default function Minimapa({ motorRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const motor = motorRef.current;
    motor?.conectarMinimapa(ref.current);
    return () => motor?.conectarMinimapa(null);
  }, [motorRef]);
  return <canvas ref={ref} className="nt-minimapa" role="img" aria-label="Minimapa del pizarrón: toque o arrastre para moverse" />;
}
