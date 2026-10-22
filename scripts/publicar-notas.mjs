// Compila Anotomía (apps/notas) y copia el resultado a public/notas/app, que es lo que publica la web.
// Se ejecuta solo en cada `npm run build` (también en Vercel). A mano: npm run publicar:notas
import { cpSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');
const origen = join(raiz, 'apps', 'notas');
const destino = join(raiz, 'public', 'notas', 'app');
const ejecutar = (orden) => execSync(orden, { cwd: origen, stdio: 'inherit' });

if (!existsSync(join(origen, 'node_modules'))) ejecutar(existsSync(join(origen, 'package-lock.json')) ? 'npm ci' : 'npm install');
ejecutar('npm run build');

rmSync(destino, { recursive: true, force: true });
cpSync(join(origen, 'dist'), destino, { recursive: true });
console.log('\nListo: Anotomía quedó compilada en public/notas/app.');
