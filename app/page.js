import Link from 'next/link';

export default function Inicio() {
  return (
    <main className="page">
      <header className="top">
        <h1>Herramientas para estudiantes</h1>
        <p className="sub">Técnicas de estudio con respaldo en la investigación y un teclado para escribir letras griegas y símbolos en sus resúmenes. Pensado para estudiantes de medicina.</p>
      </header>
      <div className="tools">
        <Link className="card tool t-met" style={{ '--i': 0 }} href="/metodos">
          <span className="ico" aria-hidden="true">✓</span>
          <h2>Métodos de estudio</h2>
          <p>Cada técnica explicada paso a paso: para qué situaciones sirve, dónde falla y cuánta investigación la respalda.</p>
          <span className="go">Ver los métodos</span>
        </Link>
        <Link className="card tool t-tec" style={{ '--i': 1 }} href="/teclado">
          <span className="ico" aria-hidden="true">α</span>
          <h2>Teclado Científico</h2>
          <p>Un teclado flotante para escribir letras griegas, subíndices y símbolos de química y medicina con un clic, directamente en su documento. Para Windows, Mac y Linux.</p>
          <span className="go">Ver y descargar</span>
        </Link>
      </div>
    </main>
  );
}
