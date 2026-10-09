import Link from 'next/link';

export default function Inicio() {
  return (
    <main className="page">
      <header className="top">
        <h1>Herramientas para estudiantes</h1>
        <p className="sub">Recursos gratuitos para estudiar mejor, pensados desde la experiencia de quien estudia. Sin publicidad, sin registro y sin fines de lucro.</p>
        <ul className="chips" aria-label="Características">
          <li>Gratis</li><li>Sin registro</li><li>Sin publicidad</li><li>Sin datos personales</li>
        </ul>
      </header>
      <div className="tools">
        <Link className="card tool t-met" style={{ '--i': 0 }} href="/metodos">
          <span className="ico" aria-hidden="true">✓</span>
          <h2>Métodos de estudio</h2>
          <p>Un catálogo de técnicas de estudio con el nivel de respaldo que tiene cada una en la evidencia. Cada estudiante elige con información.</p>
          <span className="go">Ver el catálogo</span>
        </Link>
        <Link className="card tool t-tec" style={{ '--i': 1 }} href="/teclado">
          <span className="ico" aria-hidden="true">α</span>
          <h2>Teclado Científico</h2>
          <p>Teclado flotante para escribir letras griegas y símbolos científicos con un clic en tus resúmenes. Para Windows, Linux y Mac.</p>
          <span className="go">Descargar el teclado</span>
        </Link>
      </div>
    </main>
  );
}
