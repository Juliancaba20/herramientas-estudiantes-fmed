'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const enlaces = [['/metodos', 'Métodos de estudio'], ['/teclado', 'Teclado Científico']];

export default function Nav() {
  const ruta = usePathname() || '/';
  return (
    <nav className="nav" aria-label="Principal">
      <Link className="brand" href="/"><span className="logo" aria-hidden="true">α</span>Herramientas para estudiantes</Link>
      {enlaces.map(([href, texto]) => (
        <Link key={href} href={href} aria-current={ruta.startsWith(href) ? 'page' : undefined}>{texto}</Link>
      ))}
    </nav>
  );
}
