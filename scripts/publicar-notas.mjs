// Compila Anotomía (apps/notas) y copia el resultado a public/notas/app, que es lo que publica la web.
// Uso: npm run publicar:notas   (después se sube el repositorio como siempre)
import { cpSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');
const origen = join(raiz, 'apps', 'notas');
const destino = join(raiz, 'public', 'notas', 'app');
const ejecutar = (orden) => execSync(orden, { cwd: origen, stdio: 'inherit' });

if (!existsSync(join(origen, 'node_modules'))) ejecutar('npm install');
ejecutar('npm run build');

rmSync(destino, { recursive: true, force: true });
cpSync(join(origen, 'dist'), destino, { recursive: true });
console.log('\nListo: Anotomía quedó en public/notas/app. Súbala al repositorio para publicarla.');
