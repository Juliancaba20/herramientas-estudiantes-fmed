// Historial de acciones para deshacer y rehacer, sin límite.
// Cada acción es { cambios: [{ id, antes, despues }], etiqueta }: antes = null crea, despues = null elimina.
export class Historial {
  constructor() { this.pasado = []; this.futuro = []; }
  registrar(accion) { this.pasado.push(accion); this.futuro.length = 0; this.alRegistrar?.(accion); }
  puedeDeshacer() { return this.pasado.length > 0; }
  puedeRehacer() { return this.futuro.length > 0; }
  deshacer() { const a = this.pasado.pop(); if (a) this.futuro.push(a); return a || null; }
  rehacer() { const a = this.futuro.pop(); if (a) this.pasado.push(a); return a || null; }
  limpiar() { this.pasado.length = 0; this.futuro.length = 0; }
}

export const invertir = (cambios) => cambios.map((c) => ({ id: c.id, antes: c.despues, despues: c.antes })).reverse();
