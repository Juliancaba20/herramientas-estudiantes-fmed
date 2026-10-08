import Link from 'next/link';

export default function Inicio() {
  return (
    <main className="page">
      <header className="top">
        <h1>Herramientas para estudiantes</h1>
        <p className="sub">Recursos gratuitos para estudiar mejor, pensados desde la experiencia de quien estudia. Sin publicidad, sin registro y sin fines de lucro.</p>
      </header>
      <div className="tools">
        <Link className="card tool" href="/metodos">
          <h2>Métodos de estudio</h2>
          <p>Un catálogo de técnicas de estudio con el nivel de respaldo que tiene cada una en la evidencia. Cada estudiante elige con información.</p>
        </Link>
        <Link className="card tool" href="/teclado">
          <h2>Teclado Científico</h2>
          <p>Teclado flotante para escribir letras griegas y símbolos científicos con un clic en tus resúmenes. Para Windows, Linux y Mac.</p>
        </Link>
      </div>
    </main>
  );
}
