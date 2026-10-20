import { unirRects } from './geometria.js';
import { Historial, invertir } from './historial.js';

// La escena guarda los elementos del documento y su historial. Los elementos se tratan como
// inmutables: cada cambio reemplaza el objeto por uno nuevo, lo que hace trivial deshacer y guardar.
export class Escena {
  constructor(elementos = []) {
    this.mapa = new Map();
    elementos.forEach((e) => this.mapa.set(e.id, e));
    this.historial = new Historial();
    this.sucios = new Set(); // elementos con cambios sin guardar
    this.borrados = new Set(); // elementos eliminados sin confirmar en disco
    this.oyentes = new Set();
    this._orden = null;
    this._pos = null;
    this.version = 0; // sube con cada cambio: sirve para saber si hay que recalcular algo guardado
    this._limites = null;
  }

  suscribir(f) { this.oyentes.add(f); return () => this.oyentes.delete(f); }
  _emitir() { this.oyentes.forEach((f) => f()); }
  get(id) { return this.mapa.get(id); }

  // Elementos de abajo hacia arriba (se recalcula solo cuando cambia el orden o la cantidad).
  lista() {
    if (!this._orden) {
      this._orden = [...this.mapa.values()].sort((a, b) => a.z - b.z || a.creado - b.creado);
      this._pos = new Map(this._orden.map((e, i) => [e.id, i]));
    }
    return this._orden;
  }

  // Caja que contiene todos los elementos (en caché hasta que cambie la escena).
  limites() {
    if (!this._limites || this._limites.version !== this.version) this._limites = { version: this.version, caja: unirRects(this.lista()) };
    return this._limites.caja;
  }

  zMax() { const l = this.lista(); return l.length ? l[l.length - 1].z : -1; }

  // Aplica cambios sin tocar el historial (vista previa mientras se arrastra).
  transitorio(cambios) {
    this.version++;
    for (const c of cambios) {
      const previo = this.mapa.get(c.id);
      if (c.despues === null) {
        if (previo) { this.mapa.delete(c.id); this._orden = null; }
        this.sucios.delete(c.id);
        this.borrados.add(c.id);
      } else {
        this.mapa.set(c.id, c.despues);
        this.borrados.delete(c.id);
        this.sucios.add(c.id);
        if (this._orden && previo && previo.z === c.despues.z && this._pos.has(c.id)) this._orden[this._pos.get(c.id)] = c.despues;
        else this._orden = null;
      }
    }
    this._emitir();
  }

  // Anota en el historial cambios ya aplicados (al soltar el arrastre).
  // meta (opcional): { antes, despues } con un estado del documento que no son elementos (por ejemplo,
  // la cantidad de páginas). Al deshacer o rehacer se entrega a `alMeta` para que el editor lo restaure.
  registrar(cambios, etiqueta = '', meta = null) {
    if (!cambios.length && !meta) return;
    this.historial.registrar({ cambios, etiqueta, meta });
    this._emitir();
  }

  ejecutar(cambios, etiqueta = '', meta = null) { if (!cambios.length && !meta) return; this.transitorio(cambios); this.registrar(cambios, etiqueta, meta); }

  deshacer() { const a = this.historial.deshacer(); if (a) { this.transitorio(invertir(a.cambios)); if (a.meta) this.alMeta?.(a.meta.antes); } return !!a; }
  rehacer() { const a = this.historial.rehacer(); if (a) { this.transitorio(a.cambios); if (a.meta) this.alMeta?.(a.meta.despues); } return !!a; }

  // modo: 'frente' | 'fondo' | 'subir' | 'bajar'. Reasigna z = posición para mantener el orden limpio.
  reordenar(ids, modo) {
    const sel = new Set(ids);
    const orden = [...this.lista()];
    let nuevo;
    if (modo === 'frente') nuevo = [...orden.filter((e) => !sel.has(e.id)), ...orden.filter((e) => sel.has(e.id))];
    else if (modo === 'fondo') nuevo = [...orden.filter((e) => sel.has(e.id)), ...orden.filter((e) => !sel.has(e.id))];
    else {
      nuevo = orden;
      if (modo === 'subir') {
        for (let i = nuevo.length - 2; i >= 0; i--) if (sel.has(nuevo[i].id) && !sel.has(nuevo[i + 1].id)) [nuevo[i], nuevo[i + 1]] = [nuevo[i + 1], nuevo[i]];
      } else {
        for (let i = 1; i < nuevo.length; i++) if (sel.has(nuevo[i].id) && !sel.has(nuevo[i - 1].id)) [nuevo[i], nuevo[i - 1]] = [nuevo[i - 1], nuevo[i]];
      }
    }
    const cambios = [];
    nuevo.forEach((e, i) => { if (e.z !== i) cambios.push({ id: e.id, antes: e, despues: { ...e, z: i } }); });
    this.ejecutar(cambios, 'orden');
    return cambios.length > 0;
  }

  // Para el autoguardado: entrega lo pendiente y lo marca como entregado.
  tomarPendientes() {
    const guardar = [...this.sucios].map((id) => this.mapa.get(id)).filter(Boolean);
    const borrar = [...this.borrados];
    this.sucios.clear(); this.borrados.clear();
    return { guardar, borrar };
  }

  devolverPendientes({ guardar, borrar }) {
    guardar.forEach((e) => { if (this.mapa.has(e.id)) this.sucios.add(e.id); });
    borrar.forEach((id) => { if (!this.mapa.has(id)) this.borrados.add(id); });
  }
}
