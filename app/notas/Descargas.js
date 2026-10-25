'use client';

import { useEffect, useState } from 'react';
// Mismos archivos que usa la app: repositorio, nombres de los programas, regla de qué sistema recibe qué y textos.
import {
  PROGRAMAS, urlDescarga, detectarSistema, ofertaDeInstalacion, consultarPublicacion, hayProgramaPublicado,
} from '../../apps/notas/src/pwa/escritorio.js';
import { DESCRIPCION, PRIMERA_VEZ, DONDE_GUARDA, ACTUALIZACION, NOTAS_DEL_NAVEGADOR } from '../../apps/notas/src/pwa/textosProgramas.js';

const URL_APP = '/notas/app/index.html';

const TEXTO_WEB = {
  ios: 'Se agrega a la pantalla de inicio desde Safari y se abre como una aplicación, sin descargar ningún archivo.',
  linux: 'Se instala desde Chrome o Edge y se abre en su propia ventana, sin descargar ningún archivo.',
};

// Windows 10/11, Mac, Linux y Android: la única descarga es el programa de ese sistema.
// El resto (iPad, iPhone, Chromebook, Windows antiguo…): instalación de la versión web (PWA).
// La regla está en apps/notas/src/pwa/escritorio.js.
export default function Descargas() {
  const [oferta, setOferta] = useState(null); // null mientras se detecta el equipo
  const [sistema, setSistema] = useState(null);
  const [publicacion, setPublicacion] = useState(null); // null mientras se consulta

  useEffect(() => {
    setSistema(detectarSistema());
    const o = ofertaDeInstalacion();
    setOferta(o);
    if (o.tipo !== 'programa') return undefined;
    let vivo = true;
    consultarPublicacion().then((p) => { if (vivo) setPublicacion(p); });
    return () => { vivo = false; };
  }, []);

  if (oferta === null) {
    return (
      <div className="nt-descarga">
        <p className="mut">Preparando la descarga…</p>
        <noscript>
          {Object.entries(PROGRAMAS).map(([clave, p]) => (
            <p key={clave}>{p.nombre}: <a className="btn" href={urlDescarga(clave)}>Descargar el programa ({p.tipo})</a></p>
          ))}
          <p>iPad, iPhone y otros: <a className="btn" href={`${URL_APP}#instalar`}>Instalar la versión web</a></p>
        </noscript>
      </div>
    );
  }

  const plataforma = oferta.tipo === 'programa' ? oferta.plataforma : null;
  const sinPublicar = plataforma && publicacion && !hayProgramaPublicado(publicacion, plataforma);

  if (plataforma && !sinPublicar) {
    const { nombre, tipo } = PROGRAMAS[plataforma];
    const grupo = plataforma === 'android' ? 'android' : 'computadora';
    return (
      <div className="nt-descarga">
        <div className="descargas">
          <a className="descarga es-su-equipo" href={urlDescarga(plataforma)}>
            <span>
              <em className="recomendado">Para su equipo</em>
              <b>Anotomía para {nombre}</b>
              <small>{DESCRIPCION[plataforma]}</small>
            </span>
            <span className="boton">Descargar para {nombre} ({tipo})</span>
          </a>
        </div>
        {publicacion?.version && <p className="mut version">Versión actual: <b>{publicacion.version}</b></p>}
        <details>
          <summary>La primera vez que lo instale</summary>
          <ol>{PRIMERA_VEZ[plataforma].map((paso) => <li key={paso}>{paso}</li>)}</ol>
        </details>
        <details>
          <summary>Dónde se guardan las notas y cómo se actualiza</summary>
          <p>{DONDE_GUARDA[grupo]}</p>
          <p>{ACTUALIZACION[grupo]}</p>
        </details>
        <details>
          <summary>Si ya usó Anotomía en el navegador</summary>
          <p>{NOTAS_DEL_NAVEGADOR}</p>
        </details>
      </div>
    );
  }

  // Resto de los sistemas, o programa todavía sin publicar: instalación de la versión web
  return (
    <div className="nt-descarga">
      {sinPublicar && (
        <div className="note" role="note">
          <p><b>El programa para {PROGRAMAS[plataforma].nombre} todavía no está publicado.</b> Mientras tanto puede instalar la versión web:</p>
        </div>
      )}
      <div className="descargas">
        <a className="descarga es-su-equipo" href={`${URL_APP}#instalar`}>
          <span>
            <em className="recomendado">Para su dispositivo</em>
            <b>Instalar la versión web</b>
            <small>{TEXTO_WEB[sistema] || 'Se instala desde el navegador y funciona sin conexión, sin descargar ningún archivo.'}</small>
          </span>
          <span className="boton">Instalar Anotomía</span>
        </a>
      </div>
      {sistema === 'windows' && (
        <p className="mut">Este Windows no puede ejecutar el programa (se necesita Windows 10 u 11 de 64 bits), por eso se ofrece la versión web.</p>
      )}
      {sistema === 'linux' && (
        <p className="mut">El programa para Linux es solo para computadoras de 64 bits comunes (x86_64); en otros equipos se ofrece la versión web.</p>
      )}
    </div>
  );
}
