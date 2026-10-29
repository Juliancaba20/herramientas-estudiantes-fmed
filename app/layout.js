import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/source-serif-4';
import './globals.css';
import Nav from './Nav';
import Link from 'next/link';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hipocampus.vercel.app'),
  title: { default: 'Hipocampus', template: '%s | Hipocampus' },
  description: 'Recursos de estudio pensados para estudiantes de medicina.',
  openGraph: {
    siteName: 'Hipocampus',
    title: 'Hipocampus',
    description: 'Recursos de estudio pensados para estudiantes de medicina.',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
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
          <footer>Hecho por un estudiante de medicina, para estudiantes. ¿Encontró un error o tiene una sugerencia? <Link href="/contacto">Infórmelo aquí</Link>.</footer>
        </div>
      </body>
    </html>
  );
}
