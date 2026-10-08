'use client';

import { useEffect, useState } from 'react';

const REPO = 'Juliancaba20/Teclado-Griego';
const BASE = `https://github.com/${REPO}/releases/latest/download`;

const SISTEMAS = [
  { id: 'windows', nombre: 'Windows', detalle: 'Archivo .exe, se abre con doble clic', href: `${BASE}/TecladoGriego-Windows.exe` },
  { id: 'mac', nombre: 'Mac', detalle: 'Archivo .zip, para Mac con chip M1 o posterior. Versión en prueba', href: `${BASE}/TecladoGriego-Mac.zip` },
  { id: 'linux', nombre: 'Linux', detalle: 'Archivo .tar.gz, para escritorio con X11. Versión en prueba', href: `${BASE}/TecladoGriego-Linux.tar.gz` },
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

// Mejoras opcionales: las descargas funcionan igual sin JavaScript.
export default function Descargas() {
  const [so, setSo] = useState(null);
  const [version, setVersion] = useState('1.3');

  useEffect(() => {
    setSo(detectarSistema());

    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 6000);
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: control.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((datos) => {
        const etiqueta = String(datos.tag_name || '').replace(/^[vV]/, '');
        if (/^[0-9A-Za-z.\-]{1,20}$/.test(etiqueta)) setVersion(etiqueta);
      })
      .catch(() => {}) // sin conexión o límite de GitHub: queda la versión fija
      .finally(() => clearTimeout(espera));

    return () => { clearTimeout(espera); control.abort(); };
  }, []);

  return (
    <>
      <div className="descargas">
        {SISTEMAS.map((s) => (
          <a key={s.id} className={`descarga${so === s.id ? ' es-su-equipo' : ''}`} href={s.href}>
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
