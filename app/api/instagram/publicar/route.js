import frases from '../../../../content/frases.json';
import especiales from '../../../../content/fechas-especiales.json';
import { ZONA_ARGENTINA, claveMD, fechaEnZona, indiceDelAnio, leerFecha } from '../../../lib/frase-del-dia';

// Publica en Instagram la historia del día (frase + fecha especial si corresponde).
// Lo llama una tarea programada de Vercel (ver vercel.json) todos los días a las 09:00 de Argentina.
// Protegida con CRON_SECRET: sin esa clave nadie puede disparar publicaciones.
//
// Pruebas (siempre con la cabecera Authorization: Bearer <CRON_SECRET>):
//   ?prueba=1        → muestra qué publicaría, sin publicar
//   ?fecha=05-25     → usa esa fecha en lugar de hoy (sirve para ensayar una fecha especial)
//   ?forzar=1        → publica aunque hoy ya se haya publicado

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HOST = process.env.INSTAGRAM_GRAPH_HOST || 'https://graph.instagram.com';
const VERSION = process.env.INSTAGRAM_API_VERSION ? `/${process.env.INSTAGRAM_API_VERSION}` : '';
const SITIO = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hipocampus.vercel.app').replace(/\/$/, '');
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// ---- Almacenamiento opcional (Redis de Upstash / Vercel KV): recuerda qué se publicó y guarda el token renovado ----
async function kvGet(clave) {
  if (!KV_URL) return null;
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(clave)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` }, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return j.result ?? null;
}
async function kvSet(clave, valor) {
  if (!KV_URL) return;
  await fetch(`${KV_URL}/set/${encodeURIComponent(clave)}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` }, body: typeof valor === 'string' ? valor : JSON.stringify(valor) });
}

// ---- Llamadas a la API de Instagram ----
async function graph(ruta, { metodo = 'GET', params = {}, token }) {
  const datos = new URLSearchParams({ ...params, access_token: token });
  const url = `${HOST}${VERSION}${ruta}`;
  const r = await fetch(metodo === 'GET' ? `${url}?${datos}` : url, {
    method: metodo,
    headers: metodo === 'GET' ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: metodo === 'GET' ? undefined : datos,
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Instagram respondió con error (${r.status}): ${j.error?.message || JSON.stringify(j)}`);
  return j;
}

// El token de Instagram dura 60 días. Si hay almacenamiento (KV), se renueva solo cada ~30 días.
async function obtenerToken() {
  let estado = null;
  try { estado = JSON.parse((await kvGet('ig:token')) || 'null'); } catch { estado = null; }
  let token = estado?.token || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('Falta la variable INSTAGRAM_ACCESS_TOKEN.');
  let aviso = null;
  const dias = estado?.renovado ? (Date.now() - new Date(estado.renovado).getTime()) / 86400000 : Infinity;
  if (KV_URL && dias >= 30) {
    try {
      const nuevo = await graph('/refresh_access_token', { params: { grant_type: 'ig_refresh_token' }, token });
      if (nuevo.access_token) {
        token = nuevo.access_token;
        await kvSet('ig:token', { token, renovado: new Date().toISOString() });
      }
    } catch (e) {
      aviso = `No se pudo renovar el token: ${e.message}`;
    }
  } else if (!KV_URL) {
    aviso = 'Sin almacenamiento KV el token no se renueva solo: hay que generarlo de nuevo antes de los 60 días.';
  }
  return { token, aviso };
}

async function esperarContenedor(id, token) {
  for (let i = 0; i < 8; i++) {
    const r = await graph(`/${id}`, { params: { fields: 'status_code' }, token });
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new Error(`El contenedor quedó en estado ${r.status_code}.`);
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error('Instagram tardó demasiado en procesar la imagen.');
}

export async function GET(request) {
  const clave = process.env.CRON_SECRET;
  if (!clave || request.headers.get('authorization') !== `Bearer ${clave}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pedida = searchParams.get('fecha');
  const f = pedida ? leerFecha(pedida) : fechaEnZona(ZONA_ARGENTINA);
  if (!f) return Response.json({ error: 'Use fecha=MM-DD o fecha=AAAA-MM-DD' }, { status: 400 });
  const anio = f.anio || fechaEnZona(ZONA_ARGENTINA).anio;
  const md = claveMD(f.mes, f.dia);
  const frase = frases[indiceDelAnio(f.mes, f.dia)];
  const especial = especiales[`${anio}-${md}`] || especiales[md] || null;
  const imagen = `${SITIO}/api/frase-historia?fecha=${anio}-${md}`;
  const plan = { fecha: `${anio}-${md}`, frase: `${frase.t} — ${frase.a}`, especial: especial?.titulo || null, imagen };

  try {
    if (searchParams.get('prueba')) {
      const r = await fetch(imagen, { cache: 'no-store' });
      return Response.json({ ...plan, imagen_ok: r.ok && (r.headers.get('content-type') || '').includes('image/jpeg'), publicaria: true });
    }

    const marca = `ig:publicado:${anio}-${md}`;
    if (!searchParams.get('forzar') && (await kvGet(marca))) {
      return Response.json({ ...plan, publicado: false, motivo: 'Ya se publicó hoy.' });
    }

    const { token, aviso } = await obtenerToken();
    const usuario = process.env.INSTAGRAM_USER_ID || 'me';
    const contenedor = await graph(`/${usuario}/media`, { metodo: 'POST', params: { image_url: imagen, media_type: 'STORIES' }, token });
    await esperarContenedor(contenedor.id, token);
    const publicado = await graph(`/${usuario}/media_publish`, { metodo: 'POST', params: { creation_id: contenedor.id }, token });
    await kvSet(marca, publicado.id);
    return Response.json({ ...plan, publicado: true, id: publicado.id, aviso });
  } catch (e) {
    console.error('Historia de Instagram:', e.message);
    return Response.json({ ...plan, publicado: false, error: e.message }, { status: 500 });
  }
}
