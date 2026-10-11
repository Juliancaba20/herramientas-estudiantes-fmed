import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import Catalogo from './Catalogo';

export const viewport = { themeColor: '#6d28d9' };

export const metadata = {
  title: 'Métodos de estudio',
  description: 'Catálogo de métodos de estudio: cómo se aplica cada uno, dónde falla y qué respaldo tiene en la evidencia.',
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
    <div data-tema="metodos">
      <header className="top">
        <h1>Métodos de estudio</h1>
        <p className="sub">Las técnicas de estudio más investigadas, explicadas paso a paso y con su nivel de respaldo en la evidencia. Elija la que mejor se adapte a su situación.</p>
      </header>
      <Catalogo metodos={cargar()}>
      <div className="src">
        <h2 className="t">Cómo combinarlos</h2>
        <p>Ninguna técnica funciona sola. La revisión de Dunlosky et al. (2013) ubica la práctica con pruebas y la práctica distribuida entre las de mayor utilidad, y ambas se combinan de forma natural: estudie el tema, pruébese de memoria y repita esa prueba a intervalos.</p>
        <ol>
          <li><b>Primera pasada:</b> lea con atención y entienda el tema. Para comprenderlo, sirven las preguntas elaborativas y la autoexplicación.</li>
          <li><b>Recuperación:</b> cierre el material y recuerde o resuelva preguntas. Corrija con el material.</li>
          <li><b>Repaso espaciado:</b> vuelva a probarse en días y semanas siguientes, más seguido con lo que le cuesta.</li>
          <li><b>Control:</b> compare lo que cree saber con lo que responde, y use esa brecha para decidir qué repasar.</li>
        </ol>
        <p>Como orientación para espaciar, Cepeda et al. (2008) hallaron que la separación óptima entre sesiones era de alrededor del 20-40 % del plazo hasta la prueba cuando faltaba una semana, y de alrededor del 5-10 % cuando faltaba un año. Con un examen dentro de un mes, por ejemplo, un primer repaso a los 5-6 días queda cerca de esa proporción.</p>
        <div className="note"><p>Ese estudio se hizo con personas que aprendían datos en laboratorio, no con estudiantes de medicina rindiendo exámenes, así que sirve como punto de partida y no como regla exacta.</p></div>
      </div>
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
          <li>Cepeda et al. (2008). <i>Spacing Effects in Learning: A Temporal Ridgeline of Optimal Retention</i>. Psychological Science.</li>
          <li>Rowland (2014) y Adesope et al. (2017), metaanálisis sobre la práctica con pruebas. Brunmair y Richter (2019), metaanálisis sobre práctica intercalada. St. Hilaire et al. (2024), metaanálisis sobre preguntas previas. Kobayashi, metaanálisis sobre aprender enseñando. Maye y Hurley (2026), metaanálisis sobre repetición espaciada en educación médica.</li>
          <li>Nesbit y Adesope (2006), metaanálisis sobre mapas conceptuales. Monteiro et al. (2017), Perspectives on Medical Education, sobre práctica intercalada en electrocardiografía. Brierley et al. (2022), Medical Education, metaanálisis sobre aprendizaje entre pares (doi 10.1111/medu.14672).</li>
        </ul>
        <p>Cada método incluye, al final de su ficha, las fuentes específicas que lo respaldan.</p>
        <p className="mut">Contenido en revisión. Las correcciones y sugerencias son bienvenidas: <Link href="/contacto">envíelas aquí</Link>.</p>
      </div>
      </Catalogo>
    </div>
  );
}
