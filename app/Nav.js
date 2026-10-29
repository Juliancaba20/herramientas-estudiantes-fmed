import Link from 'next/link';
import Logo from './Logo';

export default function Nav() {
  return (
    <nav className="nav" aria-label="Principal">
      <Link className="brand" href="/"><Logo />Hipocampus</Link>
    </nav>
  );
}
