import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import Nav from './Nav';
import { urlRepo } from './teclado/config';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://herramientas-estudiantes-fmed.vercel.app'),
  title: { default: 'Herramientas para estudiantes', template: '%s | Herramientas para estudiantes' },
  description: 'Técnicas de estudio con respaldo en la evidencia y un teclado para escribir letras griegas y símbolos científicos. Pensado para estudiantes de medicina.',
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', colorScheme: 'light', themeColor: '#0f766e' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <a className="skip" href="#contenido">Saltar al contenido</a>
        <div className="wrap">
          <Nav />
          <div id="contenido">{children}</div>
          <footer>Hecho por un estudiante de medicina, para estudiantes. ¿Encontró un error o tiene una sugerencia? <a href={`${urlRepo}/issues`}>Infórmelo aquí</a>.</footer>
        </div>
      </body>
    </html>
  );
}
