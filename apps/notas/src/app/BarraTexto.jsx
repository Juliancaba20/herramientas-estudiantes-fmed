import { TAMANOS_TEXTO } from '../herramientas/texto/estilo.js';
import SelectorSimbolos from './SelectorSimbolos.jsx';

// Barra de formato del texto con teclado (Etapa 6). Los botones no le quitan el foco al texto
// (onMouseDown con preventDefault), así la selección se conserva al dar formato.
const sinFoco = (e) => e.preventDefault();

function Bt({ nombre, activo, deshabilitado, alPulsar, children, ancho }) {
  return (
    <button type="button" className={`nt-bt ${activo ? 'nt-bt--on' : ''}`} title={nombre} aria-label={nombre} aria-pressed={activo === undefined ? undefined : !!activo}
      disabled={deshabilitado} style={ancho ? { minWidth: ancho } : undefined} onMouseDown={sinFoco} onClick={alPulsar}>{children}</button>
  );
}

const Linea = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const ALINEAR = { izquierda: 'M4 6h16M4 10h10M4 14h16M4 18h10', centro: 'M4 6h16M7 10h10M4 14h16M7 18h10', derecha: 'M4 6h16M10 10h10M4 14h16M10 18h10' };
const LISTA = { vineta: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01', numero: 'M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.5 13.5h2l-2 3h2.2M3.5 19h2v1.2h-1.2v1.3h1.2' };
const COLORES = [['#14192b', 'Negro (automático)'], ['#2350d8', 'Azul'], ['#d6336c', 'Rosa'], ['#1f9d55', 'Verde'], ['#e67700', 'Naranja'], ['#7048e8', 'Violeta'], ['#868e96', 'Gris']];
const RESALTADOS = [['#ffe066', 'Amarillo'], ['#b2f2bb', 'Verde'], ['#ffc9de', 'Rosa'], ['#bfe3ff', 'Celeste']];

export default function BarraTexto({ estado, motorRef }) {
  const f = (accion, valor) => motorRef.current?.formatoTexto(accion, valor);
  const t = estado;
  return (
    <div className="nt-props nt-barra-texto" data-nt-barra role="toolbar" aria-label="Formato del texto">
      <div className="nt-grupo" role="group" aria-label="Estilo del párrafo">
        <Bt nombre="Texto normal (Ctrl+Mayús+0)" activo={t.bloque === 'parrafo' && !t.lista} deshabilitado={t.enTabla} alPulsar={() => f('bloque', 'parrafo')}>Normal</Bt>
        <Bt nombre="Título 1 (Ctrl+Mayús+1)" activo={t.bloque === 'titulo1'} deshabilitado={t.enTabla} alPulsar={() => f('bloque', 'titulo1')}><b>T1</b></Bt>
        <Bt nombre="Título 2 (Ctrl+Mayús+2)" activo={t.bloque === 'titulo2'} deshabilitado={t.enTabla} alPulsar={() => f('bloque', 'titulo2')}><b>T2</b></Bt>
        <Bt nombre="Título 3 (Ctrl+Mayús+3)" activo={t.bloque === 'titulo3'} deshabilitado={t.enTabla} alPulsar={() => f('bloque', 'titulo3')}><b>T3</b></Bt>
      </div>
      <div className="nt-grupo" role="group" aria-label="Formato de letra">
        <Bt nombre="Negrita (Ctrl+B)" activo={t.negrita} alPulsar={() => f('negrita')}><b>N</b></Bt>
        <Bt nombre="Cursiva (Ctrl+I)" activo={t.cursiva} alPulsar={() => f('cursiva')}><i>C</i></Bt>
        <Bt nombre="Subrayado (Ctrl+U)" activo={t.subrayado} alPulsar={() => f('subrayado')}><u>S</u></Bt>
        <Bt nombre="Tachado (Ctrl+Mayús+X)" activo={t.tachado} alPulsar={() => f('tachado')}><s>T</s></Bt>
      </div>
      <div className="nt-grupo" role="group" aria-label="Listas y alineación">
        <Bt nombre="Lista con viñetas (Ctrl+Mayús+8)" activo={t.lista === 'vineta'} deshabilitado={t.enTabla} alPulsar={() => f('lista', 'vineta')}><Linea d={LISTA.vineta} /></Bt>
        <Bt nombre="Lista numerada (Ctrl+Mayús+7)" activo={t.lista === 'numero'} deshabilitado={t.enTabla} alPulsar={() => f('lista', 'numero')}><Linea d={LISTA.numero} /></Bt>
        {t.lista && <Bt nombre="Quitar sangría (Mayús+Tab)" deshabilitado={t.nivel === 0} alPulsar={() => f('sangria', 'menos')}>⇤</Bt>}
        {t.lista && <Bt nombre="Sangrar (Tab)" deshabilitado={t.nivel >= 2} alPulsar={() => f('sangria', 'mas')}>⇥</Bt>}
        {['izquierda', 'centro', 'derecha'].map((a) => (
          <Bt key={a} nombre={`Alinear ${a === 'centro' ? 'al centro' : `a la ${a}`} (Ctrl+Mayús+${{ izquierda: 'L', centro: 'E', derecha: 'R' }[a]})`} activo={t.alinear === a} deshabilitado={t.enTabla} alPulsar={() => f('alinear', a)}><Linea d={ALINEAR[a]} /></Bt>
        ))}
      </div>
      <div className="nt-grupo" role="group" aria-label="Tamaño">
        <Bt nombre="Letra más chica" deshabilitado={t.tamano <= TAMANOS_TEXTO[0]} alPulsar={() => f('tamano', 'menos')}>A−</Bt>
        <span className="nt-tam" aria-live="polite">{Math.round(t.tamano)}</span>
        <Bt nombre="Letra más grande" deshabilitado={t.tamano >= TAMANOS_TEXTO[TAMANOS_TEXTO.length - 1]} alPulsar={() => f('tamano', 'mas')}>A+</Bt>
      </div>
      <div className="nt-grupo" role="group" aria-label="Color de la letra">
        {COLORES.map(([c, n]) => <button key={c} type="button" aria-label={`Letra ${n}`} title={`Letra ${n}`} className="nt-color nt-color--chico" style={{ background: c }} onMouseDown={sinFoco} onClick={() => f('color', c === '#14192b' ? null : c)} />)}
      </div>
      <div className="nt-grupo" role="group" aria-label="Resaltado">
        {RESALTADOS.map(([c, n]) => <button key={c} type="button" aria-label={`Resaltar en ${n.toLowerCase()}`} title={`Resaltar en ${n.toLowerCase()}`} className="nt-color nt-color--chico" style={{ background: c }} onMouseDown={sinFoco} onClick={() => f('resaltado', c)} />)}
        <Bt nombre="Quitar resaltado" alPulsar={() => f('resaltado', null)}>⌀</Bt>
      </div>
      <SelectorSimbolos motorRef={motorRef} />
      <div className="nt-grupo" role="group" aria-label="Tabla">
        {!t.enTabla && <Bt nombre="Insertar tabla de 3 × 3" alPulsar={() => f('tabla', 'insertar')}>▦ Tabla</Bt>}
        {t.enTabla && (
          <>
            <Bt nombre="Agregar fila debajo" alPulsar={() => f('tabla', 'fila+')}>+ Fila</Bt>
            <Bt nombre="Agregar columna a la derecha" alPulsar={() => f('tabla', 'col+')}>+ Col.</Bt>
            <Bt nombre="Quitar esta fila" alPulsar={() => f('tabla', 'fila-')}>− Fila</Bt>
            <Bt nombre="Quitar esta columna" alPulsar={() => f('tabla', 'col-')}>− Col.</Bt>
            <Bt nombre="Fila de encabezado" activo={t.encabezado} alPulsar={() => f('tabla', 'encabezado')}>Encab.</Bt>
            <Bt nombre="Eliminar la tabla" alPulsar={() => f('tabla', 'borrar')}>Quitar tabla</Bt>
          </>
        )}
      </div>
      <button type="button" className="nt-btn nt-btn--primario" onMouseDown={sinFoco} onClick={() => f('terminar')} title="Terminar de escribir (Esc)">Listo</button>
    </div>
  );
}
