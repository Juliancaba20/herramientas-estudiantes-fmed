'use client';

import { useEffect, useState } from 'react';
import { REPO, PREFIJO_TAG, TAG_INICIAL, urlArchivo } from './config';

const SISTEMAS = [
  { id: 'windows', nombre: 'Windows', detalle: 'Archivo .exe, se abre con doble clic', archivo: 'TecladoGriego-Windows.exe' },
  { id: 'mac', nombre: 'Mac', detalle: 'Archivo .zip, para Mac con chip M1 o posterior. Versión en prueba', archivo: 'TecladoGriego-Mac.zip' },
  { id: 'linux', nombre: 'Linux', detalle: 'Archivo .tar.gz, para escritorio con X11. Versión en prueba', archivo: 'TecladoGriego-Linux.tar.gz' },
];

function detectarSistema() {
  const ua = navigator.userAgent || '';
  const tactil = (navigator.maxTouchPoints || 0) > 1;
  if (/Android|iPhone|iPad|iPod/i.test(ua) || (tactil && /Mac/i.test(ua))) return null;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'mac';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return null;
}

// Mejoras opcionales: las descargas funcionan igual sin JavaScript
// (apuntan a la versión indicada en config.js).
export default function Descargas() {
  const [so, setSo] = useState(null);
  const [tag, setTag] = useState(TAG_INICIAL);

  useEffect(() => {
    setSo(detectarSistema());

    // Busca la última versión publicada del teclado en este repositorio.
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 6000);
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: control.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((lista) => {
        const ultima = lista.find((r) => !r.draft && !r.prerelease && String(r.tag_name || '').startsWith(PREFIJO_TAG));
        const etiqueta = ultima && String(ultima.tag_name);
        if (etiqueta && /^[0-9A-Za-z.\-]{1,40}$/.test(etiqueta)) setTag(etiqueta);
      })
      .catch(() => {}) // sin conexión o límite de GitHub: queda la versión fija
      .finally(() => clearTimeout(espera));

    return () => { clearTimeout(espera); control.abort(); };
  }, []);

  const version = tag.replace(PREFIJO_TAG, '');

  return (
    <>
      <div className="descargas">
        {SISTEMAS.map((s) => (
          <a key={s.id} className={`descarga${so === s.id ? ' es-su-equipo' : ''}`} href={urlArchivo(tag, s.archivo)}>
            <span>
              {so === s.id && <em className="recomendado">Recomendado para su equipo</em>}
              <b>{s.nombre}</b>
              <small>{s.detalle}</small>
            </span>
            <span className="boton">Descargar</span>
          </a>
        ))}
      </div>
      <p className="mut version">Versión actual: <b>{version}</b></p>
    </>
  );
}
