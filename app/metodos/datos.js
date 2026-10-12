import fs from 'node:fs';
import path from 'node:path';

export const niveles = ['Variable', 'Limitado', 'Moderado', 'Sólido'];
export const marca = ['◇', '○', '◐', '●'];
export const significado = ['depende de cómo se aplique', 'poca investigación', 'buenos resultados, menos estudios en medicina', 'investigación abundante y coherente'];

export function cargar() {
  const dir = path.join(process.cwd(), 'content', 'metodos');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({
    ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')),
    id: f.replace(/^\d+-|\.json$/g, ''),
  }));
}
