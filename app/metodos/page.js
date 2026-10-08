import fs from 'node:fs';
import path from 'node:path';
import Catalogo from './Catalogo';

export const metadata = {
  title: 'Métodos de estudio',
  description: 'Catálogo gratuito de métodos de estudio: cómo se aplica cada uno, dónde falla y qué respaldo tiene en la evidencia.',
};

function cargar() {
  const dir = path.join(process.cwd(), 'content', 'metodos');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({
    ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
    id: f.replace(/^\d+-|\.json$/g, ''),
  }));
}

export default function Metodos() {
  return (
    <>
      <header className="top">
        <h1>Métodos de estudio</h1>
        <p className="sub">Qué existe y qué dice la evidencia. No hay un método obligatorio: cada ficha explica cómo se aplica, dónde falla y cuánto respaldo tiene, para que cada estudiante elija con información.</p>
      </header>
      <Catalogo metodos={cargar()} />
      <div className="src" style={{ paddingBottom: '2rem' }}>
        <h2 className="t">Sobre los niveles de respaldo</h2>
        <p>Los niveles son orientativos y resumen cuánta investigación sostiene que el método mejora la retención o el rendimiento, no si "le sirve" a una persona en particular. Que un método tenga poco respaldo no significa que no funcione, sino que se estudió poco o que los resultados no son claros.</p>
        <div className="note"><p>La idea de adaptar el estudio a un "estilo de aprendizaje" (visual, auditivo, kinestésico) no cuenta con una base de evidencia adecuada que la justifique (Pashler et al., 2008), por eso no figura como método.</p></div>
        <p>Fuentes de partida:</p>
        <ul>
          <li>Dunlosky et al. (2013). <i>Improving Students' Learning With Effective Learning Techniques</i>. Psychological Science in the Public Interest.</li>
          <li>Pashler et al. (2008). <i>Learning Styles: Concepts and Evidence</i>. Psychological Science in the Public Interest.</li>
          <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4031794/">Augustin, M. How to Learn Effectively in Medical School: Test Yourself, Learn Actively, and Repeat in Intervals</a>. The Yale Journal of Biology and Medicine.</li>
          <li><a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11661899/">A Literature Review on Optimizing Study Strategies in Medical Education: Insights From Exam Scores and Study Resources</a> (PMC).</li>
          <li><a href="https://pubmed.ncbi.nlm.nih.gov/21252317/">Karpicke y Blunt (2011). Retrieval practice produces more learning than elaborative studying with concept mapping</a>. Science.</li>
          <li>Nesbit y Adesope (2006), metaanálisis sobre mapas conceptuales. Monteiro et al. (2017), Perspectives on Medical Education, sobre práctica intercalada en electrocardiografía. Brierley et al. (2022), Medical Education, metaanálisis sobre aprendizaje entre pares (doi 10.1111/medu.14672).</li>
        </ul>
        <p className="mut">Contenido en revisión. Las correcciones y sugerencias son bienvenidas.</p>
      </div>
    </>
  );
}
