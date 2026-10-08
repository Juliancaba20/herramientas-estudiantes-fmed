import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: { default: 'Herramientas para estudiantes', template: '%s | Herramientas para estudiantes' },
  description: 'Herramientas gratuitas y sin fines de lucro para estudiantes, en especial de medicina.',
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <a className="skip" href="#contenido">Saltar al contenido</a>
        <div className="wrap">
          <nav className="nav" aria-label="Principal">
            <Link className="brand" href="/">Herramientas para estudiantes</Link>
            <Link href="/metodos">Métodos de estudio</Link>
            <Link href="/teclado">Teclado Científico</Link>
          </nav>
          <div id="contenido">{children}</div>
          <footer>Proyectos gratuitos, sin fines de lucro y sin recolección de datos personales.</footer>
        </div>
      </body>
    </html>
  );
}
