import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import frases from '../../../content/frases.json';
import especiales from '../../../content/fechas-especiales.json';
import { MESES, ZONA_ARGENTINA, claveMD, fechaEnZona, indiceDelAnio, leerFecha } from '../../lib/frase-del-dia';

// Imagen vertical (1080 × 1920) de la frase del día, pensada para historias de Instagram.
// Uso: /api/frase-historia            → la frase de hoy (hora de Argentina)
//      /api/frase-historia?fecha=05-25 → la de esa fecha (también acepta AAAA-MM-DD)
// Se entrega en JPEG porque la API de Instagram no acepta PNG para historias.

export const runtime = 'nodejs';

const ANCHO = 1080;
const ALTO = 1920;
const CARPETA = path.join(process.cwd(), 'app', 'api', 'frase-historia', 'fuentes');

let fuentes;
async function cargarFuentes() {
  if (!fuentes) {
    const leer = (n) => readFile(path.join(CARPETA, n));
    const [serif, titulo, tituloFuerte] = await Promise.all([leer('SourceSerif4-500-italic.woff'), leer('Bricolage-700.woff'), leer('Bricolage-800.woff')]);
    fuentes = [
      { name: 'Serif', data: serif, weight: 500, style: 'italic' },
      { name: 'Titulo', data: titulo, weight: 700, style: 'normal' },
      { name: 'Titulo', data: tituloFuerte, weight: 800, style: 'normal' },
    ];
  }
  return fuentes;
}

// Tamaño de letra según la longitud: las frases largas se achican para que siempre entren
// dentro de la zona segura (Instagram tapa ~250 px arriba y ~340 px abajo con su interfaz).
function tamanoLetra(n) {
  if (n <= 45) return 112;
  if (n <= 75) return 98;
  if (n <= 110) return 86;
  if (n <= 150) return 78;
  if (n <= 190) return 70;
  return 64;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pedida = searchParams.get('fecha');
  let f;
  if (pedida) {
    f = leerFecha(pedida);
    if (!f) return Response.json({ error: 'Use fecha=MM-DD o fecha=AAAA-MM-DD' }, { status: 400 });
    if (!f.anio) f.anio = fechaEnZona(ZONA_ARGENTINA).anio;
  } else {
    f = fechaEnZona(ZONA_ARGENTINA);
  }

  const frase = frases[indiceDelAnio(f.mes, f.dia)];
  const clave = claveMD(f.mes, f.dia);
  const especial = especiales[`${f.anio}-${clave}`] || especiales[clave] || null;
  const dominio = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hipocampus.vercel.app').replace(/^https?:\/\//, '');
  const tam = tamanoLetra(frase.t.length);
  const fondo = 'linear-gradient(160deg, #0a4f4a 0%, #0f766e 58%, #127f74 100%)';

  const imagen = new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: 'flex', position: 'relative', background: fondo, color: '#fff', fontFamily: 'Titulo' }}>
        <div style={{ position: 'absolute', display: 'flex', width: 1000, height: 1000, borderRadius: 500, right: -330, top: -300, background: 'radial-gradient(circle, rgba(255,122,99,0.55), rgba(255,122,99,0) 68%)' }} />
        <div style={{ position: 'absolute', display: 'flex', width: 800, height: 800, borderRadius: 400, left: -300, bottom: -260, background: 'radial-gradient(circle, rgba(255,255,255,0.22), rgba(255,255,255,0) 70%)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: ANCHO, height: ALTO, padding: '270px 96px 350px 96px' }}>
          {/* Parte superior: rótulo y, si corresponde, la fecha especial */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
              {`Frase del día · ${f.dia} de ${MESES[f.mes - 1]}`}
            </div>
            {especial && (
              <div style={{ display: 'flex', marginTop: 30, alignSelf: 'flex-start', padding: '16px 34px', borderRadius: 999, background: '#ff7a63', color: '#3a0f08', fontSize: 34, fontWeight: 800, lineHeight: 1.2 }}>
                {especial.titulo}
              </div>
            )}
          </div>

          {/* Centro: comilla y frase */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 230, fontWeight: 800, lineHeight: 0.8, height: 150, color: '#ff7a63' }}>{'“'}</div>
            <div style={{ display: 'flex', fontFamily: 'Serif', fontStyle: 'italic', fontWeight: 500, fontSize: tam, lineHeight: 1.28 }}>{frase.t}</div>
          </div>

          {/* Parte inferior: autor, obra y marca */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, color: '#ffd6cc' }}>{`— ${frase.a}`}</div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3 }}>{frase.o}</div>
            <div style={{ display: 'flex', marginTop: 56, paddingTop: 34, borderTop: '3px solid rgba(255,255,255,0.28)', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', fontSize: 48, fontWeight: 800 }}>Hipocampus</div>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>{dominio}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: ANCHO, height: ALTO, fonts: await cargarFuentes() },
  );

  const png = Buffer.from(await imagen.arrayBuffer());
  const jpg = await sharp(png).flatten({ background: '#0f766e' }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
  return new Response(jpg, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  });
}
