// Arma el archivo latest.json que lee el actualizador automático del programa de Anotomía.
// Lo usa .github/workflows/compilar-notas.yml:  node scripts/generar-latest-notas.mjs <carpeta> <versión> <urlBase> [notas]
// La carpeta tiene los programas ya con su nombre final y, al lado de cada uno, su firma («.sig»).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Qué archivo actualiza a qué sistema (los nombres de la clave los define el actualizador de Tauri)
export const DESTINOS = [
  { archivo: 'Anotomia-Windows.exe', claves: ['windows-x86_64', 'windows-aarch64'] }, // en Windows con ARM corre emulado
  { archivo: 'Anotomia-Mac.app.tar.gz', claves: ['darwin-aarch64', 'darwin-x86_64'] }, // un solo programa sirve para ambos chips
  { archivo: 'Anotomia-Linux.AppImage', claves: ['linux-x86_64'] },
];

// firmas: { [nombreDeArchivo]: contenido de su .sig }. Solo entran los sistemas que tienen firma.
export function construirLatest({ version, notas = '', firmas, urlBase, fecha = new Date() }) {
  const platforms = {};
  for (const { archivo, claves } of DESTINOS) {
    const signature = firmas[archivo]?.trim();
    if (!signature) continue;
    for (const clave of claves) platforms[clave] = { signature, url: `${urlBase}/${archivo}` };
  }
  if (Object.keys(platforms).length === 0) throw new Error('No hay ningún programa firmado: no se puede armar latest.json');
  return { version, notes: notas, pub_date: fecha.toISOString(), platforms };
}

export function leerFirmas(carpeta) {
  const firmas = {};
  for (const { archivo } of DESTINOS) {
    const ruta = join(carpeta, `${archivo}.sig`);
    if (existsSync(ruta)) firmas[archivo] = readFileSync(ruta, 'utf-8');
  }
  return firmas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [carpeta, version, urlBase, notas = ''] = process.argv.slice(2);
  if (!carpeta || !version || !urlBase) { console.error('Uso: node generar-latest-notas.mjs <carpeta> <versión> <urlBase> [notas]'); process.exit(2); }
  const latest = construirLatest({ version, notas, firmas: leerFirmas(carpeta), urlBase });
  writeFileSync(join(carpeta, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
  console.log(`latest.json: versión ${version} para ${Object.keys(latest.platforms).join(', ')}`);
}
