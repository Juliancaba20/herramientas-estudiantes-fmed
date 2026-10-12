import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cargar, niveles, marca, significado } from '../datos';

export const dynamicParams = false;

export function generateStaticParams() {
  return cargar().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const m = cargar().find((x) => x.id === id);
  if (!m) return {};
  return { title: m.n, description: `${m.q} Cómo se aplica, dónde falla y qué dice la evidencia.` };
}

export const viewport = { themeColor: '#6d28d9' };

export default async function Metodo({ params }) {
  const { id } = await params;
  const todos = cargar();
  const i = todos.findIndex((x) => x.id === id);
  if (i < 0) notFound();
  const m = todos[i];
  const nombres = Object.fromEntries(todos.map((x) => [x.id, x.n]));
  const ant = todos[i - 1];
  const sig = todos[i + 1];

  return (
    <div data-tema="metodos">
      <header className="top">
        <p className="migas"><Link href="/metodos">← Métodos de estudio</Link></p>
        <h1 className="h1-metodo">{m.n}</h1>
        <p className="sub">{m.q}</p>
      </header>

      <article className="ficha" data-l={m.l}>
        <section className="resumen">
          <div className="resumen-respaldo">
            <span className="pill">Respaldo: {niveles[m.l]}</span>
            <p className="mut">{marca[m.l]} {significado[m.l]}</p>
          </div>
          <dl>
            <div><dt>Esfuerzo</dt><dd>{m.e}</dd></div>
            <div><dt>Útil para</dt><dd>{m.u}</dd></div>
            <div><dt>Dónde falla</dt><dd>{m.f}</dd></div>
          </dl>
        </section>

        <div className="ficha-cols">
        <section>
          <h2>Cómo se aplica</h2>
          <ol className="pasos">{m.p.map((x) => <li key={x}>{x}</li>)}</ol>
          {m.x && <p className="ej"><b>Ejemplo en medicina.</b> {m.x}</p>}
        </section>

        {m.c && (
          <section>
            <h2>Consejos para aplicarlo mejor</h2>
            <ul>{m.c.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        )}

        <section>
          <h2>Qué dice la evidencia</h2>
          <p>{m.r}</p>
          {m.d && <ul>{m.d.map((x) => <li key={x}>{x}</li>)}</ul>}
        </section>

        {m.m && (
          <section>
            <h2>Combina bien con</h2>
            <div className="comb-lista">
              {m.m.filter((x) => nombres[x]).map((x) => <Link key={x} href={`/metodos/${x}`}>{nombres[x]}</Link>)}
            </div>
          </section>
        )}

        {m.s && (
          <section>
            <h2>Fuentes</h2>
            <ul className="fuentes">{m.s.map((x) => <li key={x.t}>{x.u ? <a href={x.u} target="_blank" rel="noopener noreferrer">{x.t}</a> : x.t}</li>)}</ul>
          </section>
        )}
        </div>

        <p className="mut">Los niveles de respaldo son orientativos. ¿Encontró un error o tiene una sugerencia? <Link href="/contacto">Infórmelo aquí</Link>.</p>
      </article>

      <nav className="ficha-nav" aria-label="Otros métodos">
        {ant ? <Link href={`/metodos/${ant.id}`}>← {ant.n}</Link> : <span />}
        <Link href="/metodos">Ver todos</Link>
        {sig ? <Link href={`/metodos/${sig.id}`}>{sig.n} →</Link> : <span />}
      </nav>
    </div>
  );
}
