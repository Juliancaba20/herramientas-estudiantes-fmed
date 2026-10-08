'use client';
import { useState } from 'react';

const niveles = ['Variable', 'Limitado', 'Moderado', 'Sólido'];
const marca = ['◇', '○', '◐', '●'];
const filtros = { todos: 'Todos', poco: 'Tengo poco tiempo', memorizar: 'Hay mucho que memorizar', comprender: 'Necesito comprender', grupo: 'Quiero estudiar en grupo' };
const grupos = [
  { t: 'Respaldo sólido', d: 'Investigación abundante y coherente. Son los métodos con más apoyo.', niv: [3] },
  { t: 'Respaldo moderado', d: 'Buenos resultados en varios contextos, con menos estudios en medicina.', niv: [2] },
  { t: 'Respaldo limitado o variable', d: 'Poca investigación, o resultados que dependen de cómo se aplique.', niv: [1, 0] },
];
const significado = ['depende de cómo se aplique', 'poca investigación', 'buenos resultados, menos estudios en medicina', 'investigación abundante y coherente'];

export default function Catalogo({ metodos }) {
  const [k, setK] = useState('todos');
  const [q, setQ] = useState('');
  const [abiertos, setAbiertos] = useState(false);
  const visibles = metodos.filter((m) => (k === 'todos' || m.t.includes(k)) && m.n.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="grid">
      <aside aria-label="Filtros">
        <h2>Buscar</h2>
        <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del método" aria-label="Buscar método por nombre" />
        <h2>Situación (opcional)</h2>
        <div className="f" role="group" aria-label="Filtrar por situación">
          {Object.entries(filtros).map(([c, v]) => (
            <button key={c} type="button" aria-pressed={k === c} onClick={() => setK(c)}>{v}</button>
          ))}
        </div>
        <h2>Niveles de respaldo</h2>
        <ul className="leg">
          {[3, 2, 1, 0].map((n) => (
            <li key={n} data-l={n}><b>{marca[n]} {niveles[n]}</b> <span>{significado[n]}</span></li>
          ))}
        </ul>
        <button id="toggle" type="button" onClick={() => setAbiertos(!abiertos)}>{abiertos ? 'Cerrar todos los detalles' : 'Abrir todos los detalles'}</button>
      </aside>
      <section id="catalogo">
        <p id="cnt" aria-live="polite">Mostrando {visibles.length} de {metodos.length} métodos</p>
        {grupos.map((g) => {
          const items = visibles.filter((m) => g.niv.includes(m.l));
          if (!items.length) return null;
          return (
            <section className="grp" key={g.t}>
              <h2>{g.t}</h2>
              <p>{g.d}</p>
              <div className="cards">
                {items.map((m) => (
                  <article className="card" id={m.id} data-l={m.l} key={m.id}>
                    <h3><a href={'#' + m.id} style={{ textDecoration: 'none', color: 'inherit' }}>{m.n}</a></h3>
                    <span className="lv" aria-hidden="true">{marca[m.l]} </span><span className="lv">Respaldo: {niveles[m.l]}</span>
                    <p className="q">{m.q}</p>
                    <dl>
                      <div><dt>Esfuerzo</dt><dd>{m.e}</dd></div>
                      <div><dt>Útil para</dt><dd>{m.u}</dd></div>
                      <div><dt>Dónde falla</dt><dd>{m.f}</dd></div>
                    </dl>
                    <details key={String(abiertos)} open={abiertos}>
                      <summary>Cómo se aplica y qué dice la evidencia</summary>
                      <ol>{m.p.map((x) => <li key={x}>{x}</li>)}</ol>
                      <p>{m.r}</p>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
        {visibles.length === 0 && <p id="vacio">Ningún método coincide con la búsqueda. Pruebe con otro nombre o quite el filtro.</p>}
        <h2 className="t">Comparación rápida</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Método</th><th>Respaldo</th><th>Esfuerzo</th><th>Útil para</th></tr></thead>
            <tbody>
              {metodos.map((m) => (
                <tr key={m.id} data-l={m.l}><td><a href={'#' + m.id}>{m.n}</a></td><td className="lvl">{marca[m.l]} {niveles[m.l]}</td><td>{m.e}</td><td>{m.u}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
