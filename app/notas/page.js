import Link from 'next/link';
import Descargas from './Descargas';

export const viewport = { themeColor: '#1d4ed8' };

export const metadata = {
  title: 'Anotomía',
  description: 'La app definitiva para tomar notas en clase y hacer resúmenes: pizarrón infinito, páginas A4 y tarjetas, a mano o con teclado.',
};

// La app ya está publicada en /notas/app/index.html (carpeta public/notas/app). Mientras esta constante
// sea false, la página muestra el aviso de «en desarrollo» y no enlaza a la app (sirve para probarla en
// PC, Android e iPad sin que nadie llegue desde la web). Con true muestra las descargas (ver Descargas.js).
const DISPONIBLE = true;

const FORMATOS = [
  {
    t: 'Pizarrón infinito',
    d: 'Un lienzo sin bordes para moverse libremente: escriba, dibuje y acomode ideas donde quiera, y acérquese o aléjese cuando lo necesite.',
  },
  {
    t: 'Páginas A4',
    d: 'Hojas una debajo de otra, como en un procesador de texto, con márgenes y numeración. Pensadas para resúmenes que se leen y se imprimen.',
  },
  {
    t: 'Tarjetas',
    d: 'Tarjetas de distintos tamaños, tantas como necesite, con modo de estudio en pantalla completa y opción de imprimirlas.',
  },
];

const ESCRITURA = [
  {
    t: 'A mano',
    d: 'Con mouse, con el dedo o con lápiz. El trazo sigue al lápiz sin demora y el grosor se mantiene aunque acerque o aleje la vista.',
  },
  {
    t: 'Con teclado',
    d: 'Escriba texto con formato (títulos, listas, colores, tablas) y combínelo con el dibujo en el mismo documento.',
  },
  {
    t: 'Renglones a su gusto',
    d: 'Rayado, cuadriculado o puntos, que se activan y desactivan sin mover nada de lo escrito. Pueden verse siempre, aparecer un instante o permanecer ocultos.',
  },
];

export default function Notas() {
  return (
    <main className="page" data-tema="notas">
      <header className="top">
        <h1>Anotomía</h1>
        <p className="sub">La app definitiva para tomar notas en clase y hacer resúmenes.</p>
      </header>

      {DISPONIBLE ? (
        // Windows, Mac, Linux y Android reciben solo su programa; el resto de los sistemas, la versión web.
        <Descargas />
      ) : (
        <div className="note" role="note">
          <p><b>En desarrollo.</b> Anotomía todavía no está disponible. Esta página se irá completando a medida que avance la app y, cuando esté lista, podrá usarla desde aquí mismo.</p>
        </div>
      )}

      <section className="src">
        <h2 className="t">Tres formatos, a elegir al crear cada documento</h2>
        <div className="nt-cols">
          {FORMATOS.map((f, i) => (
            <div className="card" style={{ '--i': i }} key={f.t}>
              <h3>{f.t}</h3>
              <p className="q">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="src">
        <h2 className="t">Escriba como prefiera</h2>
        <div className="nt-cols">
          {ESCRITURA.map((f, i) => (
            <div className="card" style={{ '--i': i }} key={f.t}>
              <h3>{f.t}</h3>
              <p className="q">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="dos-col" style={{ paddingTop: '2rem' }}>
        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>Para PC, tablet y iPad</h2>
          <p>Se descarga como programa en Windows (.exe), Mac (.dmg), Linux (.AppImage) y Android (.apk); en iPad y iPhone se instala desde el navegador. En todos los casos se adapta a cada pantalla: botones grandes y herramientas al alcance del pulgar en tablets, y todo el espacio disponible en computadoras.</p>
        </section>
        <section className="rv">
          <h2 className="t" style={{ marginTop: 0 }}>Sus notas, en su dispositivo</h2>
          <p>Los documentos se guardan en el propio dispositivo y la app está pensada para funcionar sin conexión. Para pasar notas de un equipo a otro se usan archivos propios (<code>.nota</code>) que se exportan e importan, e incluyen todo el contenido.</p>
        </section>
      </div>

      <section className="src" style={{ paddingTop: '2rem' }}>
        <p>¿Tiene una idea o una necesidad que Anotomía debería cubrir? Será de gran ayuda para su desarrollo.</p>
        <Link className="btn" href="/contacto">Enviar una sugerencia</Link>
      </section>
    </main>
  );
}
